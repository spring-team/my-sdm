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
    buttonForCommand,
    GitHubRepoRef,
    MappedParameters,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    DeclarationType,
} from "@atomist/sdm";
import { deleteRepository } from "@atomist/sdm-core/lib/util/github/ghub";
import {
    Attachment,
    SlackMessage,
} from "@atomist/slack-messages";

export interface DeleteRepoParameters {
    repo: string;
    owner: string;
}

/**
 * Select one of the current user's repo for possible deletion.
 */
export const selectRepoToDelete: CommandHandlerRegistration<DeleteRepoParameters> = {
    name: "selectRepoToDelete",
    intent: ["delete repo", "kill -9"],
    description: "delete a repo",
    parameters: {
        repo: {
            declarationType: DeclarationType.Mapped,
            uri: MappedParameters.GitHubRepository,
        },
        owner: {
            declarationType: DeclarationType.Mapped,
            uri: MappedParameters.GitHubOwner,
        },
    },
    listener: async ci => {
        const repoRef = GitHubRepoRef.from(ci.parameters);
        const attachment: Attachment = {
            text: `:warning: Really delete repo at ${repoRef.url}? *Cannot be undone*`,
            fallback: "Delete repo",
            actions: [buttonForCommand({ text: `Delete repo at ${repoRef.url}?` },
                "deleteRepo",
                ci.parameters as any,
            ),
            ],
        };
        const message: SlackMessage = {
            attachments: [attachment],
        };
        await ci.addressChannels(message);
    },
};

/**
 * Perform repo deletion. No intent so not directly available to users.
 */
export const deleteRepo: CommandHandlerRegistration<DeleteRepoParameters> = {
    name: "deleteRepo",
    parameters: {
        owner: {},
        repo: {},
    },
    listener: async ci => {
        await ci.addressChannels(`Deleting ${ci.parameters.owner}/${ci.parameters.repo}`);
        const grr = GitHubRepoRef.from(ci.parameters);
        await deleteRepository(ci.credentials, grr);
    },
};
