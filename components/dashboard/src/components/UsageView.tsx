/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceType } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ListUsageRequest, Ordering, Usage, WorkspaceInstanceUsageData } from "@gitpod/gitpod-protocol/lib/usage";
import dayjs from "dayjs";
import { forwardRef, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useLocation } from "react-router";
import Header from "../components/Header";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import { useListUsage } from "../data/usage/usage-query";
import { useWorkspaceClasses } from "../data/workspaces/workspace-classes-query";
import Spinner from "../icons/Spinner.svg";
import { ReactComponent as UsageIcon } from "../images/usage-default.svg";
import Pagination from "../Pagination/Pagination";
import { toRemoteURL } from "../projects/render-utils";
import { gitpodHostUrl } from "../service/service";
import "./react-datepicker.css";
import { Heading1, Heading2, Subheading } from "./typography/headings";

interface UsageViewProps {
    attributionId: AttributionId;
}

function UsageView({ attributionId }: UsageViewProps) {
    const [page, setPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState("");
    const startOfCurrentMonth = dayjs().startOf("month");
    const [startDate, setStartDate] = useState(startOfCurrentMonth);
    const [endDate, setEndDate] = useState(dayjs());
    const supportedClasses = useWorkspaceClasses();
    const location = useLocation();
    useEffect(() => {
        const match = /#(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})/.exec(location.hash);
        if (match) {
            try {
                setStartDate(dayjs(match[1], "YYYY-MM-DD"));
                setEndDate(dayjs(match[2], "YYYY-MM-DD"));
            } catch (e) {
                console.error(e);
            }
        }
    }, [location]);
    const request = useMemo(() => {
        const request: ListUsageRequest = {
            attributionId: AttributionId.render(attributionId),
            from: startDate.startOf("day").valueOf(),
            to: endDate.endOf("day").valueOf(),
            order: Ordering.ORDERING_DESCENDING,
            pagination: {
                perPage: 50,
                page,
            },
        };
        return request;
    }, [attributionId, endDate, page, startDate]);
    const usagePage = useListUsage(request);

    if (usagePage.error) {
        if ((usagePage.error as any).code === ErrorCodes.PERMISSION_DENIED) {
            setErrorMessage("Access to usage details is restricted to team owners.");
        } else {
            setErrorMessage(`Error: ${usagePage.error?.message}`);
        }
    }

    useEffect(() => {
        if (startDate.isAfter(endDate)) {
            setErrorMessage("The start date needs to be before the end date.");
            return;
        }
        if (startDate.add(300, "day").isBefore(endDate)) {
            setErrorMessage("Range is too long. Max range is 300 days.");
            return;
        }
        setErrorMessage("");
        setPage(1);
    }, [startDate, endDate, setPage]);

    const getType = (type: WorkspaceType) => {
        if (type === "regular") {
            return "Workspace";
        }
        return "Prebuild";
    };

    const getDisplayName = (workspaceClass: string) => {
        const workspaceDisplayName = supportedClasses.data?.find((wc) => wc.id === workspaceClass)?.displayName;
        if (!workspaceDisplayName) {
            return workspaceClass;
        }
        return workspaceDisplayName;
    };

    const isRunning = (usage: Usage) => {
        if (usage.kind !== "workspaceinstance") {
            return false;
        }
        const metaData = usage.metadata as WorkspaceInstanceUsageData;
        return metaData.endTime === "" || metaData.endTime === undefined;
    };

    const getMinutes = (usage: Usage) => {
        if (usage.kind !== "workspaceinstance") {
            return "";
        }
        const metaData = usage.metadata as WorkspaceInstanceUsageData;
        const end = metaData.endTime ? new Date(metaData.endTime).getTime() : Date.now();
        const start = new Date(metaData.startTime).getTime();
        const lengthOfUsage = Math.floor(end - start);
        const inMinutes = (lengthOfUsage / (1000 * 60)).toFixed(1);
        return inMinutes + " min";
    };

    const handleMonthClick = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
        setStartDate(start);
        setEndDate(end);
    };

    const getBillingHistory = () => {
        let rows = [];
        // This goes back 6 months from the current month
        for (let i = 1; i < 7; i++) {
            const startDate = dayjs().subtract(i, "month").startOf("month");
            const endDate = startDate.endOf("month");
            rows.push(
                <div
                    key={`billing${i}`}
                    className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500 truncate cursor-pointer gp-link"
                    onClick={() => handleMonthClick(startDate, endDate)}
                >
                    {startDate.format("MMMM YYYY")}
                </div>,
            );
        }
        return rows;
    };

    const displayTime = (time: string | number) => {
        const options: Intl.DateTimeFormatOptions = {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
        };
        return new Date(time).toLocaleDateString(undefined, options).replace("at ", "");
    };

    const currentPaginatedResults =
        usagePage.data?.usageEntriesList.filter((u) => u.kind === "workspaceinstance") ?? [];
    const DateDisplay = forwardRef((arg: any, ref: any) => (
        <div
            className="px-2 py-0.5 text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800 rounded-md cursor-pointer flex items-center hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={arg.onClick}
            ref={ref}
        >
            <div className="font-medium">{arg.value}</div>
            <div>
                <svg
                    width="20"
                    height="20"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    onClick={arg.onClick}
                    ref={ref}
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
                    />
                    <title>Change Date</title>
                </svg>
            </div>
        </div>
    ));

    return (
        <>
            <Header
                title={
                    <div className="flex items-baseline">
                        <Heading1 tracking="tight">Usage</Heading1>
                        <Subheading className="ml-3">(updated every 15 minutes).</Subheading>
                    </div>
                }
                subtitle={
                    <div className="tracking-wide flex mt-3 items-center">
                        <Subheading className="mr-1">Showing usage from </Subheading>
                        <DatePicker
                            selected={startDate.toDate()}
                            onChange={(date) => date && setStartDate(dayjs(date))}
                            selectsStart
                            startDate={startDate.toDate()}
                            endDate={endDate.toDate()}
                            maxDate={endDate.toDate()}
                            customInput={<DateDisplay />}
                            dateFormat={"MMM d, yyyy"}
                        />
                        <Subheading className="mx-1">to</Subheading>
                        <DatePicker
                            selected={endDate.toDate()}
                            onChange={(date) => date && setEndDate(dayjs(date))}
                            selectsEnd
                            startDate={startDate.toDate()}
                            endDate={endDate.toDate()}
                            minDate={startDate.toDate()}
                            customInput={<DateDisplay />}
                            dateFormat={"MMM d, yyyy"}
                        />
                    </div>
                }
            />
            <div className="app-container pt-5">
                {errorMessage && <p className="text-base">{errorMessage}</p>}
                {!errorMessage && (
                    <div className="flex space-x-16">
                        <div className="flex">
                            <div className="space-y-8 mb-6" style={{ width: "max-content" }}>
                                <div className="flex flex-col truncate">
                                    <div className="text-base text-gray-500 truncate">Current Month</div>
                                    <div
                                        className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500 truncate cursor-pointer mb-5"
                                        onClick={() => handleMonthClick(startOfCurrentMonth, dayjs())}
                                    >
                                        {dayjs(startOfCurrentMonth).format("MMMM YYYY")}
                                    </div>
                                    <div className="text-base text-gray-500 truncate">Previous Months</div>
                                    {getBillingHistory()}
                                </div>
                                {!usagePage.isLoading && (
                                    <div>
                                        <div className="flex flex-col truncate">
                                            <div className="text-base text-gray-500">Credits</div>
                                            <div className="flex text-lg text-gray-600 font-semibold">
                                                <span className="dark:text-gray-400">
                                                    {usagePage.data?.creditsUsed.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {!usagePage.isLoading &&
                            (usagePage === undefined || currentPaginatedResults.length === 0) &&
                            !errorMessage && (
                                <div className="flex flex-col w-full mb-8">
                                    <Heading2 className="text-center mt-8">No sessions found.</Heading2>
                                    <Subheading className="text-center mt-1">
                                        Have you started any
                                        <a className="gp-link" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                            {" "}
                                            workspaces
                                        </a>{" "}
                                        in {startDate.format("MMMM YYYY")} or checked your other organizations?
                                    </Subheading>
                                </div>
                            )}
                        {usagePage.isLoading && (
                            <div className="flex items-center justify-center w-full space-x-2 text-gray-400 text-sm pt-16 pb-40">
                                <img alt="Loading Spinner" className="h-4 w-4 animate-spin" src={Spinner} />
                                <span>Fetching usage...</span>
                            </div>
                        )}
                        {!usagePage.isLoading && currentPaginatedResults.length > 0 && (
                            <div className="flex flex-col w-full mb-8">
                                <ItemsList className="mt-2 text-gray-400 dark:text-gray-500">
                                    <Item
                                        header={false}
                                        className="grid grid-cols-12 gap-x-3 bg-gray-100 dark:bg-gray-800"
                                    >
                                        <ItemField className="col-span-2 my-auto ">
                                            <span>Type</span>
                                        </ItemField>
                                        <ItemField className="col-span-5 my-auto">
                                            <span>ID</span>
                                        </ItemField>
                                        <ItemField className="my-auto">
                                            <span>Credits</span>
                                        </ItemField>
                                        <ItemField className="my-auto" />
                                        <ItemField className="my-auto">
                                            <span>Timestamp</span>
                                        </ItemField>
                                    </Item>
                                    {currentPaginatedResults &&
                                        currentPaginatedResults.map((usage) => {
                                            return (
                                                <div
                                                    key={usage.workspaceInstanceId}
                                                    className="flex p-3 grid grid-cols-12 gap-x-3 justify-between transition ease-in-out rounded-xl"
                                                >
                                                    <div className="flex flex-col col-span-2 my-auto">
                                                        <span className="text-gray-600 dark:text-gray-100 text-md font-medium">
                                                            {getType(
                                                                (usage.metadata as WorkspaceInstanceUsageData)
                                                                    .workspaceType,
                                                            )}
                                                        </span>
                                                        <span className="text-sm text-gray-400 dark:text-gray-500">
                                                            {getDisplayName(
                                                                (usage.metadata as WorkspaceInstanceUsageData)
                                                                    .workspaceClass,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col col-span-5 my-auto">
                                                        <div className="flex">
                                                            {isRunning(usage) && (
                                                                <div
                                                                    className="rounded-full w-2 h-2 text-sm align-middle bg-green-500 my-auto mx-1"
                                                                    title="Still running"
                                                                />
                                                            )}
                                                            <span className="truncate text-gray-600 dark:text-gray-100 text-md font-medium">
                                                                {
                                                                    (usage.metadata as WorkspaceInstanceUsageData)
                                                                        .workspaceId
                                                                }
                                                            </span>
                                                        </div>
                                                        <span className="text-sm truncate text-gray-400 dark:text-gray-500">
                                                            {(usage.metadata as WorkspaceInstanceUsageData)
                                                                .contextURL &&
                                                                toRemoteURL(
                                                                    (usage.metadata as WorkspaceInstanceUsageData)
                                                                        .contextURL,
                                                                )}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col my-auto">
                                                        <span className="text-right text-gray-500 dark:text-gray-400 font-medium">
                                                            {usage.credits}
                                                        </span>
                                                        <span className="text-right text-sm text-gray-400 dark:text-gray-500">
                                                            {getMinutes(usage)}
                                                        </span>
                                                    </div>
                                                    <div className="my-auto" />
                                                    <div className="flex flex-col col-span-3 my-auto">
                                                        <span className="text-gray-400 dark:text-gray-500 truncate font-medium">
                                                            {displayTime(usage.effectiveTime!)}
                                                        </span>
                                                        <div className="flex">
                                                            {(usage.metadata as WorkspaceInstanceUsageData)
                                                                .workspaceType === "prebuild" ? (
                                                                <UsageIcon className="my-auto w-4 h-4 mr-1" />
                                                            ) : (
                                                                ""
                                                            )}
                                                            {(usage.metadata as WorkspaceInstanceUsageData)
                                                                .workspaceType === "prebuild" ? (
                                                                <span className="text-sm text-gray-400 dark:text-gray-500">
                                                                    Gitpod
                                                                </span>
                                                            ) : (
                                                                <div className="flex">
                                                                    <img
                                                                        className="my-auto rounded-full w-4 h-4 inline-block align-text-bottom mr-1 overflow-hidden"
                                                                        src={
                                                                            (
                                                                                usage.metadata as WorkspaceInstanceUsageData
                                                                            ).userAvatarURL || ""
                                                                        }
                                                                        alt="user avatar"
                                                                    />
                                                                    <span className="text-sm text-gray-400 dark:text-gray-500">
                                                                        {(usage.metadata as WorkspaceInstanceUsageData)
                                                                            .userName || ""}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </ItemsList>
                                {usagePage.data &&
                                    usagePage.data.pagination &&
                                    usagePage.data.pagination.totalPages > 1 && (
                                        <Pagination
                                            currentPage={usagePage.data.pagination.page}
                                            setPage={setPage}
                                            totalNumberOfPages={usagePage.data.pagination.totalPages}
                                        />
                                    )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default UsageView;
