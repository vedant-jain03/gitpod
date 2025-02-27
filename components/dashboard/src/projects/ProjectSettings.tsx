/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project, ProjectSettings } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useCallback, useContext, useEffect, useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import Alert from "../components/Alert";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { getGitpodService } from "../service/service";
import { ProjectContext, useCurrentProject } from "./project-context";
import { getProjectSettingsMenu, getProjectTabs } from "./projects.routes";
import { Heading2, Subheading } from "../components/typography/headings";
import { RemoveProjectModal } from "./RemoveProjectModal";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";

export function ProjectSettingsPage(props: { project?: Project; children?: React.ReactNode }) {
    return (
        <PageWithSubMenu
            subMenu={getProjectSettingsMenu(props.project)}
            title={props.project?.name || "Loading..."}
            subtitle="Manage project settings and configuration"
            tabs={getProjectTabs(props.project)}
        >
            {props.children}
        </PageWithSubMenu>
    );
}

export default function ProjectSettingsView() {
    const { setProject } = useContext(ProjectContext);
    const { project } = useCurrentProject();
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const team = useCurrentOrg().data;
    const history = useHistory();

    useEffect(() => {
        if (team) {
            getGitpodService().server.getBillingModeForTeam(team.id).then(setBillingMode);
        } else {
            getGitpodService().server.getBillingModeForUser().then(setBillingMode);
        }
    }, [team]);

    const updateProjectSettings = useCallback(
        (settings: ProjectSettings) => {
            if (!project) return;

            const newSettings = { ...project.settings, ...settings };
            getGitpodService().server.updateProjectPartial({ id: project.id, settings: newSettings });
            setProject({ ...project, settings: newSettings });
        },
        [project, setProject],
    );

    const setWorkspaceClass = useCallback(
        async (value: string) => {
            if (!project) {
                return value;
            }
            const before = project.settings?.workspaceClasses?.regular;
            updateProjectSettings({ workspaceClasses: { ...project.settings?.workspaceClasses, regular: value } });
            return before;
        },
        [project, updateProjectSettings],
    );

    const setWorkspaceClassForPrebuild = useCallback(
        async (value: string) => {
            if (!project) {
                return value;
            }
            const before = project.settings?.workspaceClasses?.prebuild;
            updateProjectSettings({ workspaceClasses: { ...project.settings?.workspaceClasses, prebuild: value } });
            return before;
        },
        [project, updateProjectSettings],
    );

    const onProjectRemoved = useCallback(() => {
        history.push("/projects");
    }, [history]);

    // TODO: Render a generic error screen for when an entity isn't found
    if (!project) return null;

    return (
        <ProjectSettingsPage project={project}>
            <Heading2>Prebuilds</Heading2>
            <Subheading>Choose the workspace machine type for your prebuilds.</Subheading>
            {BillingMode.canSetWorkspaceClass(billingMode) ? (
                <div className="max-w-md">
                    <SelectWorkspaceClassComponent
                        selectedWorkspaceClass={project.settings?.workspaceClasses?.prebuild}
                        onSelectionChange={setWorkspaceClassForPrebuild}
                    />
                </div>
            ) : (
                <Alert type="message" className="mt-4">
                    <div className="flex flex-col">
                        <span>
                            To access{" "}
                            <a
                                className="gp-link"
                                href="https://www.gitpod.io/docs/configure/workspaces/workspace-classes"
                            >
                                large workspaces
                            </a>{" "}
                            and{" "}
                            <a className="gp-link" href="https://www.gitpod.io/docs/configure/billing/pay-as-you-go">
                                pay-as-you-go
                            </a>
                            , first cancel your existing plan.
                        </span>
                        <Link className="mt-2" to={project.teamId ? "/billing" : "/plans"}>
                            <button>Go to {project.teamId ? "Organization" : "Personal"} Billing</button>
                        </Link>
                    </div>
                </Alert>
            )}
            <CheckboxInputField
                label="Enable Incremental Prebuilds"
                hint={
                    <span>
                        When possible, use an earlier successful prebuild as a base to create new prebuilds. This can
                        make your prebuilds significantly faster, especially if they normally take longer than 10
                        minutes.{" "}
                        <a className="gp-link" href="https://www.gitpod.io/changelog/faster-incremental-prebuilds">
                            Learn more
                        </a>
                    </span>
                }
                checked={project.settings?.useIncrementalPrebuilds ?? false}
                onChange={(checked) => updateProjectSettings({ useIncrementalPrebuilds: checked })}
            />
            <CheckboxInputField
                label="Cancel Prebuilds on Outdated Commits"
                hint="Cancel pending or running prebuilds on the same branch when new commits are pushed."
                checked={!project.settings?.keepOutdatedPrebuildsRunning}
                onChange={(checked) => updateProjectSettings({ keepOutdatedPrebuildsRunning: !checked })}
            />
            <CheckboxInputField
                label={
                    <span>
                        Use Last Successful Prebuild{" "}
                        <PillLabel type="warn" className="font-semibold mt-2 ml-2 py-0.5 px-2 self-center">
                            Alpha
                        </PillLabel>
                    </span>
                }
                hint="Skip waiting for prebuilds in progress and use the last successful prebuild from previous
                    commits on the same branch."
                checked={!!project.settings?.allowUsingPreviousPrebuilds}
                onChange={(checked) =>
                    updateProjectSettings({
                        allowUsingPreviousPrebuilds: checked,
                        // we are disabling prebuild cancellation when incremental workspaces are enabled
                        keepOutdatedPrebuildsRunning: checked || project?.settings?.keepOutdatedPrebuildsRunning,
                    })
                }
            />
            <div className="flex mt-4 max-w-2xl">
                <div className="flex flex-col ml-6">
                    <label
                        htmlFor="prebuildNthCommit"
                        className="text-gray-800 dark:text-gray-100 text-md font-semibold cursor-pointer tracking-wide"
                    >
                        Skip Prebuilds
                    </label>
                    <input
                        type="number"
                        id="prebuildNthCommit"
                        min="0"
                        max="100"
                        step="5"
                        className="mt-2"
                        disabled={!project.settings?.allowUsingPreviousPrebuilds}
                        value={
                            project.settings?.prebuildEveryNthCommit === undefined
                                ? 0
                                : project.settings?.prebuildEveryNthCommit
                        }
                        onChange={({ target }) =>
                            updateProjectSettings({
                                prebuildEveryNthCommit: Math.abs(Math.min(Number.parseInt(target.value), 100)) || 0,
                            })
                        }
                    />
                    <div className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                        The number of commits that are skipped between prebuilds.
                    </div>
                </div>
            </div>
            <div>
                <Heading2 className="mt-12">Workspaces</Heading2>
                <Subheading>Choose the workspace machine type for your workspaces.</Subheading>
                {BillingMode.canSetWorkspaceClass(billingMode) ? (
                    <div className="max-w-md">
                        <SelectWorkspaceClassComponent
                            selectedWorkspaceClass={project.settings?.workspaceClasses?.regular}
                            onSelectionChange={setWorkspaceClass}
                        />
                    </div>
                ) : (
                    <Alert type="message" className="mt-4">
                        <div className="flex flex-col">
                            <span>
                                To access{" "}
                                <a
                                    className="gp-link"
                                    href="https://www.gitpod.io/docs/configure/workspaces/workspace-classes"
                                >
                                    large workspaces
                                </a>{" "}
                                and{" "}
                                <a
                                    className="gp-link"
                                    href="https://www.gitpod.io/docs/configure/billing/pay-as-you-go"
                                >
                                    pay-as-you-go
                                </a>
                                , first cancel your existing plan.
                            </span>
                            <Link className="mt-2" to={project.teamId ? "../billing" : "/plans"}>
                                <button>Go to {project.teamId ? "Organization" : "Personal"} Billing</button>
                            </Link>
                        </div>
                    </Alert>
                )}
            </div>
            <div className="">
                <Heading2 className="mt-12">Remove Project</Heading2>
                <Subheading className="pb-4">
                    This will delete the project and all project-level environment variables you've set for this
                    project.
                </Subheading>
                <button className="danger secondary" onClick={() => setShowRemoveModal(true)}>
                    Remove Project
                </button>
            </div>
            {showRemoveModal && (
                <RemoveProjectModal
                    project={project}
                    onRemoved={onProjectRemoved}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}
        </ProjectSettingsPage>
    );
}
