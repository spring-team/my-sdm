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

import {
    astUtils,
    doWithJson,
    GitHubRepoRef,
    MappedParameters,
    MicrogrammarBasedFileParser,
    projectUtils,
    TypeScriptES6FileParser,
} from "@atomist/automation-client";
import {
    microgrammar,
    takeUntil,
} from "@atomist/microgrammar";
import {
    CodeTransform,
    DeclarationType,
    GeneratorRegistration,
} from "@atomist/sdm";
import { globalConfiguration } from "@atomist/sdm-pack-global";
import { PackageJson } from "../../element/node/PackageJson";
import { SdmEnablementTransform } from "../support/sdmEnablement";

export interface TakeHomeCommandParameters {
    screenName: string;
}

const newReadmeTitleSection = `# Based on @atomist/global-sdm

Your own SDM.

`;

/**
 * Command to take the global SDM home.
 * Uses the global SDM as a seed, creating a repo in the user's org and
 * enabling the SDM on it.
 */
export const takeHomeCommand: GeneratorRegistration<TakeHomeCommandParameters> = {
    name: "take home",
    intent: ["create sdm", "take home", "takeout"],
    parameters: {
        screenName: { declarationType: DeclarationType.Mapped, uri: MappedParameters.SlackUserName },
    },
    startingPoint: GitHubRepoRef.from({ owner: "atomisthq", repo: "global-sdm" }),
    transform: [
        removeDependency("@atomist/sdm-pack-global"),
        removeImportOfSingleSymbol("globalConfiguration"),
        removeAddExtensionPack("globalConfiguration()"),
        updateReadme(newReadmeTitleSection),
        SdmEnablementTransform,
    ],
};

function removeDependency(name: string): CodeTransform {
    return async p => {
        await doWithJson(p, "package.json", json => {
            const pkg = json as PackageJson;
            delete pkg.dependencies[name];
        });
        await doWithJson(p, "package-lock.json", json => {
            const pkg = json as PackageJson;
            delete pkg.dependencies[name];
        });
    };
}

// Must be a single import
function removeImportOfSingleSymbol(symbol: string): CodeTransform {
    return async p => {
        await astUtils.zapAllMatches(p,
            TypeScriptES6FileParser,
            "lib/machine.ts",
            `//ImportDeclaration[//Identifier[@value='${symbol}']]`);
    };
}

// Remove
// sdm.addExtensionPacks(globalConfiguration());
function removeAddExtensionPack(packSymbol: string): CodeTransform {
    return async p => {
        await projectUtils.doWithFiles(p, "lib/machine.ts",
            async f => {
                await f.replaceAll(`sdm.addExtensionPacks(${packSymbol});`, "");
            },
        );
    };
}

export function updateReadme(replacement: string = newReadmeTitleSection,
                             from: string = "# @atomist/global-sdm",
                             to: string = "[atomist-doc]:"): CodeTransform {
    const grammar = microgrammar({
        literal: from,
        rest: takeUntil(to),
    });
    return async p => {
        await astUtils.doWithAllMatches(p,
            new MicrogrammarBasedFileParser("root", "section", grammar),
            "README.md", "//section",
            m => {
                m.$value = replacement;
            });

    };
}
