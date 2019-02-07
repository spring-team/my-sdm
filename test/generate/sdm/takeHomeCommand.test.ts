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
    GitHubRepoRef,
    InMemoryProject,
    SeedDrivenGeneratorParameters,
} from "@atomist/automation-client";
import {
    chainTransforms,
    CodeTransform,
} from "@atomist/sdm";
import * as assert from "assert";
import { PackageJson } from "../../../lib/element/node/PackageJson";
import {
    takeHomeCommand,
    TakeHomeCommandParameters,
} from "../../../lib/generate/sdm/takeHomeCommand";

describe("take home transforms", () => {

    // tslint:disable-next-line:deprecation
    const transform = chainTransforms(...(takeHomeCommand.transform as Array<CodeTransform<TakeHomeCommandParameters>>));

    const parameters: TakeHomeCommandParameters & SeedDrivenGeneratorParameters = {
        screenName: "rod",
        source: {
            repoRef: GitHubRepoRef.from({ owner: "sourceowner", repo: "sourcerepo" }),
        },
        target: {
            repoRef: GitHubRepoRef.from({ owner: "targetowner", repo: "targetrepo" }),
            description: "thing",
            webhookUrl: "https://thing",
            visibility: "public",
            credentials: { token: "foo" },
        },
    };

    it("should not change name", async () => {
        const p = InMemoryProject.of({ path: "package.json", content: Package_Json });
        await transform(p, { parameters } as any, parameters);
        const newPackage = p.findFileSync("package.json");
        const json = JSON.parse(newPackage.getContentSync()) as PackageJson;
        assert.strictEqual(json.name, "@atomist/global-sdm");
        // assert.strictEqual(json.version, "1.0.1");
    });

    it("should remove dependency", async () => {
        const p = InMemoryProject.of(
            {
                path: "package.json", content: Package_Json,
            },
        );
        await transform(p, { parameters } as any, parameters);
        const newPackage = p.findFileSync("package.json").getContentSync();
        assert(!newPackage.includes("@atomist/sdm-pack-configuration"), newPackage);
    });

    it("should remove dependency from package-lock.json", async () => {
        const p = InMemoryProject.of({ path: "package-lock.json", content: Package_Json }, {
            path: "package-lock.json",
            content: PackageLockJson,
        });
        await transform(p, { parameters } as any, parameters);
        const newPackage = p.findFileSync("package-lock.json").getContentSync();
        assert(!newPackage.includes("@atomist/sdm-pack-global"), newPackage);
    });

    it("should remove import from machine.ts", async () => {
        const p = InMemoryProject.of({ path: "lib/machine.ts", content: machineTs });
        await transform(p, { parameters } as any, parameters);
        const newMachine = p.findFileSync("lib/machine.ts").getContentSync();
        assert(!newMachine.includes("import { globalConfiguration }"), newMachine);
        assert(newMachine.includes("import { editModes } from \"@atomist/automation-client\";\n"), newMachine);
    });

    it("should remove pack usage from machine.ts", async () => {
        const p = InMemoryProject.of({ path: "lib/machine.ts", content: machineTs });
        await transform(p, { parameters } as any, parameters);
        const newMachine = p.findFileSync("lib/machine.ts").getContentSync();
        assert(!newMachine.includes("sdm.addExtensionPacks(globalConfiguration())"), newMachine);
    });

    it("should update README", async () => {
        const p = InMemoryProject.of({ path: "README.md", content: readme });
        await transform(p, { parameters } as any, parameters);
        const newReadme = p.findFileSync("README.md").getContentSync();
        assert(!newReadme.includes(`# @atomist/global-sdm

Atomist Global SDM, which is capable of running on behalf of all users.

Also forms the basis of user SDMs.`), newReadme);
        assert(newReadme.includes(`# Based on @atomist/global-sdm

Your own SDM.`), newReadme);
    });

});

// tslint:disable
const Package_Json = `{
  "name": "@atomist/global-sdm",
  "version": "0.0.28",
  "description": "Global Demo SDM",
  "author": {
    "name": "Atomist",
    "email": "support@atomist.com",
    "url": "https://atomist.com/"
  },
  "license": "Apache-2.0",
  "homepage": "https://github.com/atomisthq/global-sdm#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/atomisthq/global-sdm.git"
  },
  "bugs": {
    "url": "https://github.com/atomisthq/global-sdm/issues"
  },
  "keywords": [
    "atomist",
    "automation",
    "sdm",
    "seed"
  ],
  "main": "./index.js",
  "types": "./index.d.ts",
  "dependencies": {
    "@atomist/automation-client": "1.3.0-master.20190203162633",
    "@atomist/automation-client-ext-dashboard": "1.0.2-master.20190122114232",
    "@atomist/automation-client-ext-logzio": "1.0.2-master.20190111233251",
    "@atomist/sdm": "1.3.0-master.20190205121804",
    "@atomist/sdm-pack-global": "1.3.0-master.20190203162110",
    "@atomist/sdm-core": "1.3.0-master.20190203162110",
    "@atomist/sdm-pack-analysis": "0.1.0-master.20190205100640",
    "@atomist/sdm-pack-build": "1.0.4-master.20190110123121",
    "@atomist/sdm-pack-docker": "1.1.0-kaniko.20190130195724",
    "@atomist/sdm-pack-fingerprints": "2.0.0-updates.20190125141235",
    "@atomist/sdm-pack-issue": "1.1.1-master.20190120184619",
    "@atomist/sdm-pack-node": "1.0.3-master.20190130224046",
    "@atomist/sdm-pack-spring": "1.1.1-master.20190131212713",
    "@atomist/slack-messages": "^1.1.0",
    "@kubernetes/client-node": "^0.7.2",
    "@types/git-url-parse": "^9.0.0",
    "@types/jsonwebtoken": "^8.3.0",
    "@types/package-json": "^4.0.1",
    "@types/request": "^2.48.1",
    "@types/yamljs": "^0.2.30",
    "fs-extra": "^7.0.1",
    "gc-stats": "^1.2.1",
    "git-url-parse": "^11.1.2",
    "jsonwebtoken": "^8.4.0",
    "lodash": "^4.17.11",
    "ts-essentials": "^1.0.2",
    "yamljs": "^0.3.0"
  },
  "devDependencies": {
    "@atomist/sdm-local": "1.0.5-master.20190115145628",
    "@types/mocha": "^5.2.5",
    "@types/power-assert": "^1.5.0",
    "espower-typescript": "^9.0.0",
    "mocha": "^5.2.0",
    "npm-run-all": "^4.1.5",
    "power-assert": "^1.6.0",
    "rimraf": "^2.6.2",
    "supervisor": "^0.12.0",
    "ts-node": "^7.0.0",
    "tslint": "^5.11.0",
    "typedoc": "^0.13.0",
    "typescript": "^3.2.2"
  },
  "directories": {
    "test": "test"
  },
  "scripts": {
    "autotest": "supervisor --watch index.ts,lib,test --extensions ts --no-restart-on exit --quiet --exec npm -- test",
    "build": "run-s compile test lint doc",
    "clean": "run-p clean:compile clean:test clean:doc clean:run",
    "clean:compile": "rimraf git-info.json \\"index.{d.ts,js{,.map}}\\" \\"{lib,test}/**/*.{d.ts,js{,.map}}\\" lib/typings/types.ts",
    "clean:dist": "run-s clean clean:npm",
    "clean:doc": "rimraf doc",
    "clean:npm": "rimraf node_modules",
    "clean:run": "rimraf *-v8.log profile.txt log",
    "clean:test": "rimraf .nyc_output coverage",
    "compile": "run-s git:info gql:gen compile:ts",
    "compile:ts": "tsc --project .",
    "doc": "typedoc --mode modules --excludeExternals --ignoreCompilerErrors --exclude \\"**/*.d.ts\\" --out doc index.ts lib",
    "git:info": "atm-git-info",
    "gql:gen": "atm-gql-gen",
    "lint": "tslint --config tslint.json --format verbose --project .",
    "lint:fix": "npm run lint -- --fix",
    "start": "atm-start",
    "test": "mocha --require espower-typescript/guess \\"test/**/*.test.ts\\"",
    "test:one": "mocha --require espower-typescript/guess \\"test/**/\${TEST:-*.test.ts}\\"",
    "typedoc": "npm run doc"
  },
  "engines": {
    "node": ">=8.1.0",
    "npm": ">=5.0.0"
  }
}
`;

const PackageLockJson = `{
  "name": "@atomist/global-sdm",
  "version": "0.0.28",
  "lockfileVersion": 1,
  "requires": true,
  "dependencies": {
    "@atomist/sdm-pack-configuration": {
      "version": "0.3.1",
      "resolved": "https://registry.npmjs.org/@apollographql/apollo-tools/-/apollo-tools-0.3.1.tgz",
      "integrity": "sha512-1AVbiOm/3Uj91/7D8pVpap6CfF87Kuwy6m4divFw/Zm4Xno4Nkwd7C4UaMiulFVydLoUqhd/ivsr37QbWOcMSA==",
      "requires": {
        "apollo-env": "0.3.1"
      }
    }
}`;

const machineTs = `/*
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
import { ConfigurationPack } from "@atomist/sdm-pack-configuration";
import {
    checkNpmCoordinatesImpactHandler,
    fingerprintImpactHandler,
    fingerprintSupport,
    messageMaker,
} from "@atomist/sdm-pack-fingerprints";
import {
    issueSupport,
    singleIssuePerCategoryManaging,
} from "@atomist/sdm-pack-issue";
import { NodeModulesProjectListener } from "@atomist/sdm-pack-node";
import { DockerBuildInterpreter } from "../element/docker/DockerBuildInterpreter";

import {
    dropDownSeedUrlParameterDefinition,
    FreeTextSeedUrlParameterDefinition,
} from "../generate/universal/seedParameter";

interface Interpreted {
    interpretation: Interpretation;
}

export function machine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({
        name: "Global SDM",
        configuration,
    });
    
    sdm.addExtensionPacks(globalConfiguration());
    
}`;

const readme = `<p align="center">
  <img src="https://images.atomist.com/sdm/SDM-Logo-Dark.png">
</p>

# @atomist/global-sdm

Atomist Global SDM, which is capable of running on behalf of all users.

Also forms the basis of user SDMs.

[atomist-doc]: https://docs.atomist.com/ (Atomist Documentation)

## Getting started

See the [Developer Quick Start][atomist-quick] to jump straight to
creating an SDM.

[atomist-quick]: https://docs.atomist.com/quick-start/ (Atomist - Developer Quick Start)

`;
