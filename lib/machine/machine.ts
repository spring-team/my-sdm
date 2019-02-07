/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { editModes } from "@atomist/automation-client";
import {
    attachFacts,
    descriptionFromState,
    DoNotSetAnyGoals,
    formatDate,
    ImmaterialGoals,
    not,
    onAnyPush,
    SdmGoalState,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    StatefulPushListenerInvocation,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    gitHubGoalStatus,
    goalState,
} from "@atomist/sdm-core";
import { formatDuration } from "@atomist/sdm-core/lib/util/misc/time";
import {
    analysis,
    analyzerBuilder,
    assessInspection,
    buildGoals,
    checkGoals,
    containerGoals,
    controlGoals,
    Interpretation,
    materialChange,
    PlaceholderTransformRecipeContributor,
    preferencesScanner,
    SnipTransformRecipeContributor,
    testGoals,
} from "@atomist/sdm-pack-analysis";
import { deployGoals } from "@atomist/sdm-pack-analysis/lib/analysis/Interpretation";
import {
    checkNpmCoordinatesImpactHandler,
    fingerprintImpactHandler,
    fingerprintSupport,
    messageMaker,
} from "@atomist/sdm-pack-fingerprints";
import { globalConfiguration } from "@atomist/sdm-pack-global";
import {
    issueSupport,
    singleIssuePerCategoryManaging,
} from "@atomist/sdm-pack-issue";
import { k8sSupport } from "@atomist/sdm-pack-k8s";
import { NodeModulesProjectListener } from "@atomist/sdm-pack-node";
import { SelectedRepoSource } from "../common/SelectedRepoFinder";
import {
    deleteRepo,
    selectRepoToDelete,
} from "../convenience/deleteRepo";
import { DockerBuildInterpreter } from "../element/docker/DockerBuildInterpreter";
import { dockerScanner } from "../element/docker/dockerScanner";
import { K8sDeployInterpreter } from "../element/k8s/K8sDeployInterpreter";
import { k8sScanner } from "../element/k8s/k8sScanner";
import { esLintReviewCategory } from "../element/node/eslintCodeInspection";
import { NpmDependencyFingerprint } from "../element/node/nodeFingerprint";
import { NodeStackSupport } from "../element/node/nodeStackSupport";
import { SpringBootStackSupport } from "../element/spring-boot/springBootStackSupport";
import { EmulateTravisBuildInterpreter } from "../element/travis/EmulateTravisBuildInterpreter";
import { travisScanner } from "../element/travis/travisScanner";
import { takeHomeCommand } from "../generate/sdm/takeHomeCommand";
import {
    addSeed,
    forkSeed,
    listSeeds,
    preferencesSeedSource,
    removeSeed,
} from "../generate/seed-management/seedManagement";
import { selectSeed } from "../generate/seed-management/selectSeed";
import {
    dropDownSeedUrlParameterDefinition,
    FreeTextSeedUrlParameterDefinition,
} from "../generate/universal/seedParameter";
import {
    universalGenerator,
    UniversalGeneratorName,
} from "../generate/universal/universalGenerator";
import { universalNodeGenerator } from "../generate/universal/universalNodeGenerator";
import {
    disableCommand,
    disableGoalCommand,
    disableOrgCommand,
    enableCommand,
    enableGoalCommand,
    enableOrgCommand,
} from "../preference/commands";
import { IsSdmEnabled } from "../preference/pushTests";
import { DefaultSeeds } from "./seeds";

interface Interpreted {
    interpretation: Interpretation;
}

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({
        name: "Global SDM",
        configuration,
    });

    const analyzer = analyzerBuilder()
        .withStack(NodeStackSupport)
        .withStack(SpringBootStackSupport)
        .withScanner(dockerScanner)
        .withScanner(k8sScanner)
        .withScanner(travisScanner)
        .withScanner(preferencesScanner)
        .withInterpreter(new DockerBuildInterpreter())
        .withInterpreter(new EmulateTravisBuildInterpreter())
        .withInterpreter(new K8sDeployInterpreter())
        .withTransformRecipeContributor({
            contributor: new PlaceholderTransformRecipeContributor(),
            optional: false,
            originator: "placeholders",
        })
        .withTransformRecipeContributor({
            contributor: new SnipTransformRecipeContributor(),
            optional: false,
            originator: "default-snip",
        })
        .build();

    analyzer.autofixGoal.withProjectListener(NodeModulesProjectListener);
    analyzer.codeInspectionGoal
        .withListener(singleIssuePerCategoryManaging(esLintReviewCategory, true, () => true))
        .withProjectListener(NodeModulesProjectListener);

    // TODO CD the following can go: just here for temp timings while we work things out
    sdm.addGoalExecutionListener(async gi => {
        if (gi.goalEvent.state === SdmGoalState.in_process && !(gi.goalEvent as any).__start) {
            (gi.goalEvent as any).__start = Date.now();
        } else if (gi.goalEvent.state !== SdmGoalState.in_process && !!(gi.goalEvent as any).__start) {
            const start: number = (gi.goalEvent as any).__start;
            const duration = formatDuration(Date.now() - start);
            if (!!gi.result) {
                if (!!gi.result.description) {
                    gi.result.description = `${gi.result.description} | ${duration}`;
                } else {
                    gi.result.description = `${descriptionFromState(gi.goal, gi.goalEvent.state)} | ${duration}`;
                }
            }
        }
    });

    sdm.withPushRules(
        whenPushSatisfies(not(IsSdmEnabled)).setGoals(DoNotSetAnyGoals),

        attachFacts<Interpreted>(async pu => {
            const interpretation = await analyzer.interpret(pu.project, pu);
            return { interpretation };
        }),

        whenPushSatisfies<StatefulPushListenerInvocation<Interpreted>>(materialChange)
            .itMeans("immaterial change")
            .setGoals(ImmaterialGoals.andLock()),

        onAnyPush<StatefulPushListenerInvocation<Interpreted>>()
            .itMeans("control")
            .setGoalsWhen(pu => controlGoals(pu.facts.interpretation)),
        onAnyPush<StatefulPushListenerInvocation<Interpreted>>()
            .itMeans("checks")
            .setGoalsWhen(pu => checkGoals(pu.facts.interpretation, analyzer)),
        onAnyPush<StatefulPushListenerInvocation<Interpreted>>()
            .itMeans("build")
            .setGoalsWhen(pu => buildGoals(pu.facts.interpretation, analyzer)),
        onAnyPush<StatefulPushListenerInvocation<Interpreted>>()
            .itMeans("test")
            .setGoalsWhen(pu => testGoals(pu.facts.interpretation, analyzer)),
        onAnyPush<StatefulPushListenerInvocation<Interpreted>>()
            .itMeans("container build")
            .setGoalsWhen(pu => containerGoals(pu.facts.interpretation, analyzer)),
        onAnyPush<StatefulPushListenerInvocation<Interpreted>>()
            .itMeans("deploy")
            .setGoalsWhen(pu => deployGoals(pu.facts.interpretation, analyzer)),
    );

    sdm.addCommand(selectRepoToDelete);
    sdm.addCommand(deleteRepo);

    sdm.addCodeInspectionCommand(assessInspection(analyzer));

    sdm.addGeneratorCommand(forkSeed(analyzer));
    sdm.addCommand(addSeed(analyzer));
    sdm.addCommand(removeSeed());
    sdm.addCommand(listSeeds);

    sdm.addGeneratorCommand(takeHomeCommand);

    // Universal generator, which requires dynamic parameters
    sdm.addGeneratorCommand(universalGenerator(analyzer, {
        name: UniversalGeneratorName,
        intent: `create ${sdm.configuration.name.replace("@", "")}`,
        description: "create a project from any seed repo, based on analysis",
        seedParameter: FreeTextSeedUrlParameterDefinition,
    }));

    // Create node from a free text input
    sdm.addGeneratorCommand(universalNodeGenerator({
        name: "CreateNode",
        intent: `create node ${sdm.configuration.name.replace("@", "")}`,
        description: "create a project from any Node seed repo",
        seedParameter: FreeTextSeedUrlParameterDefinition,
    }));

    sdm.addGeneratorCommand(universalNodeGenerator({
        name: "CreateNodeFromList",
        description: "create a project from a curated list of Node seed repos",
        intent: `discover node ${sdm.configuration.name.replace("@", "")}`,
        seedParameter: dropDownSeedUrlParameterDefinition(...DefaultSeeds),
    }));

    const globalSeeds: SelectedRepoSource = {
        description: "Global seeds",
        seedFinder: async () => DefaultSeeds,
    };
    sdm.addCommand(selectSeed({
        name: "selectSeed",
        intent: `select seed`,
        description: "create a new project, selecting a seed project",
        generatorName: "CreateNode",
        generatorsToShow: 10,
        sources: [preferencesSeedSource, globalSeeds],
    }));

    // Command registrations
    sdm.addCommand(enableCommand(sdm))
        .addCommand(disableCommand(sdm))
        .addCommand(enableOrgCommand(sdm))
        .addCommand(disableOrgCommand(sdm))
        .addCommand(enableGoalCommand(sdm))
        .addCommand(disableGoalCommand(sdm));

    sdm.addExtensionPacks(globalConfiguration());

    // Extension Pack registrations
    sdm.addExtensionPacks(
        analysis(),
        gitHubGoalStatus(),
        goalState(),
        k8sSupport(),
        issueSupport({
            labelIssuesOnDeployment: true,
            closeCodeInspectionIssuesOnBranchDeletion: {
                enabled: true,
                source: esLintReviewCategory,
            },
        }),
        fingerprintSupport({
            fingerprints: NpmDependencyFingerprint,
            handlers: [
                checkNpmCoordinatesImpactHandler(),
                fingerprintImpactHandler(
                    {
                        transformPresentation: (ci, p) => {
                            return new editModes.PullRequest(
                                `apply-fingerprint-${formatDate()}`,
                                ci.parameters.title,
                                ci.parameters.body,
                                undefined,
                                p.id.branch,
                                {
                                    method: editModes.AutoMergeMethod.Merge,
                                    mode: editModes.AutoMergeMode.SuccessfulCheck,
                                });
                        },
                        messageMaker,
                    },
                )],
        }),
    );

    return sdm;
}
