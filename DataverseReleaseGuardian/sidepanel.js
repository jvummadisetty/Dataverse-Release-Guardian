// ============================================================
// DATAVERSE RELEASE GUARDIAN - SIDE PANEL
// Clean consolidated build
// ============================================================

let loadedSolutions = [];
let analyzedComponents = [];
let resolvedTables = [];
let selectedTable = null;

let resolvedColumns = [];
let resolvedForms = [];
let resolvedViews = [];
let resolvedRelationships = [];
let resolvedBusinessRules = [];
let resolvedProcesses = [];

let selectedColumn = null;
let activeColumnFilter = "all";
let tableIncludesSubcomponents = false;
let currentTableSection = "columns";
let componentInspectorReturnSection = "forms";

let rgMissingDependencies = [];
let rgUniqueMissingComponents = [];
let rgDependencyFilter = "all";

let rgCurrentDependencyBundle = {
    dependents: [],
    required: []
};

let rgCurrentScreen = "home";

let rg25ExplorerData = null;
let rg25ExplorerSolutionId = null;
let rg25ExplorerLoadingPromise = null;


// ============================================================
// COMPONENT TYPES
// ============================================================

const RG_COMPONENT_TYPES = {
    1: "Table",
    2: "Column",
    3: "Relationship",
    4: "Choice Value",
    9: "Choice",
    10: "Table Relationship",
    14: "Table Key",
    16: "Privilege",
    20: "Security Role",
    24: "Form",
    26: "View",
    29: "Workflow / Process",
    31: "Report",
    44: "Duplicate Rule",
    46: "Table Map",
    47: "Column Map",
    48: "Ribbon Command",
    50: "Ribbon Customization",
    52: "Ribbon Rule",
    59: "Chart",
    60: "System Form",
    61: "Web Resource",
    62: "Site Map",
    63: "Connection Role",
    64: "Complex Control",
    65: "Hierarchy Rule",
    66: "Custom Control",
    68: "Custom Control Default Config",
    70: "Field Security Profile",
    71: "Field Permission",
    90: "Plugin Type",
    91: "Plugin Assembly",
    92: "Plugin Step",
    93: "Plugin Step Image",
    95: "Service Endpoint",
    150: "Routing Rule",
    151: "Routing Rule Item",
    152: "SLA",
    153: "SLA Item",
    154: "Convert Rule",
    155: "Convert Rule Item",
    161: "Mobile Offline Profile",
    162: "Mobile Offline Profile Item",
    165: "Similarity Rule",
    166: "Data Source Mapping",
    201: "SDK Message",
    202: "SDK Message Filter",
    203: "SDK Message Pair",
    204: "SDK Message Request",
    205: "SDK Message Request Field",
    206: "SDK Message Response",
    207: "SDK Message Response Field",
    208: "Import Map",
    210: "Web Wizard",
    300: "Canvas App",
    371: "Connection Reference",
    372: "Connector",
    380: "Environment Variable Definition",
    381: "Environment Variable Value",
    400: "AI Project Type",
    401: "AI Project",
    402: "AI Configuration"
};


const RG_DEPENDENCY_TYPES = {
    0: "None",
    1: "Solution Internal",
    2: "Published",
    4: "Unpublished"
};


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        bindClick(
            "detectButton",
            detectEnvironment
        );

        bindClick(
            "whoAmIButton",
            testDataverseConnection
        );

        bindClick(
            "loadSolutionsButton",
            loadSolutions
        );

        bindClick(
            "analyzeSolutionButton",
            analyzeSelectedSolution
        );

        bindClick(
            "tablesSummary",
            loadSolutionTables
        );

        bindClick(
            "backToTablesButton",
            closeTableInspector
        );

        bindClick(
            "backToColumnsButton",
            closeColumnInspector
        );

        bindClick(
            "backToComponentListButton",
            closeComponentInspector
        );

        bindClick(
            "filterAllColumns",
            function () {

                setColumnFilter(
                    "all"
                );
            }
        );

        bindClick(
            "filterIncludedColumns",
            function () {

                setColumnFilter(
                    "included"
                );
            }
        );

        bindClick(
            "filterNotIncludedColumns",
            function () {

                setColumnFilter(
                    "notIncluded"
                );
            }
        );

        bindClick(
            "showColumnsButton",
            function () {

                showTableComponentSection(
                    "columns"
                );
            }
        );

        bindClick(
            "showFormsButton",
            function () {

                showTableComponentSection(
                    "forms"
                );
            }
        );

        bindClick(
            "showViewsButton",
            function () {

                showTableComponentSection(
                    "views"
                );
            }
        );

        bindClick(
            "showRelationshipsButton",
            function () {

                showTableComponentSection(
                    "relationships"
                );
            }
        );

        bindClick(
            "showBusinessRulesButton",
            function () {

                showTableComponentSection(
                    "businessRules"
                );
            }
        );

        bindClick(
            "showProcessesButton",
            function () {

                showTableComponentSection(
                    "processes"
                );
            }
        );

        bindInput(
            "tableSearch",
            filterTableList
        );

        bindInput(
            "columnSearch",
            filterColumnList
        );

        bindInput(
            "formsSearch",
            renderFormsFiltered
        );

        bindInput(
            "viewsSearch",
            renderViewsFiltered
        );

        bindInput(
            "relationshipsSearch",
            renderRelationshipsFiltered
        );

        bindInput(
            "businessRulesSearch",
            renderBusinessRulesFiltered
        );

        bindInput(
            "processesSearch",
            renderProcessesFiltered
        );

        document
            .getElementById(
                "solutionSelect"
            )
            ?.addEventListener(
                "change",
                function () {

                    solutionChanged();

                    rg25ClearExplorerCache();

                    if (
                        typeof rg282UpdateSourceSolution ===
                        "function"
                    ) {

                        rg282UpdateSourceSolution();
                    }
                }
            );


        // Readiness UI still uses these controllers.
        // In the later HTML cleanup we will move their static
        // markup completely into sidepanel.html.

        rgCreateReadinessPanel();

        rgCreateColumnDependencyPanel();


        setTimeout(
            function () {

                rgInitializeAppNavigation();

                rg25RebindSolutionSummary();

                rg25AddExplorerShortcuts();

            },
            200
        );


        detectEnvironment();
    }
);


// ============================================================
// BASIC HELPERS
// ============================================================

function bindClick(
    id,
    handler
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;
    }


    element.addEventListener(
        "click",
        handler
    );
}


function bindInput(
    id,
    handler
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return;
    }


    element.addEventListener(
        "input",
        handler
    );
}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value ??
            "";
    }
}


function rgSetText(
    id,
    value
) {

    setText(
        id,
        value
    );
}


function rgClearElement(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.innerHTML =
            "";
    }
}


function getSearchValue(
    id
) {

    return String(
        document.getElementById(
            id
        )?.value ||
        ""
    )
        .toLowerCase()
        .trim();
}


function searchMatches(
    search,
    ...values
) {

    if (!search) {

        return true;
    }


    return values.some(
        function (value) {

            return String(
                value ??
                ""
            )
                .toLowerCase()
                .includes(
                    search
                );
        }
    );
}


function getLocalizedLabel(
    value
) {

    return (
        value
            ?.UserLocalizedLabel
            ?.Label ||

        value
            ?.LocalizedLabels
            ?.[0]
            ?.Label ||

        null
    );
}


function rgEscapeHtml(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function rg25IsZeroGuid(
    value
) {

    return (
        String(
            value ||
            ""
        )
            .toLowerCase() ===
        "00000000-0000-0000-0000-000000000000"
    );
}


// ============================================================
// ENVIRONMENT
// ============================================================

async function detectEnvironment() {

    try {

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        if (!tabs.length) {

            showEnvironmentError(
                "No active tab found."
            );

            return;
        }


        const tab =
            tabs[0];


        if (!tab.url) {

            showEnvironmentError(
                "Unable to read current tab."
            );

            return;
        }


        const url =
            new URL(
                tab.url
            );


        if (
            !url.hostname.includes(
                "dynamics.com"
            )
        ) {

            showEnvironmentError(
                "Open a Dynamics 365 page."
            );

            return;
        }


        const params =
            new URLSearchParams(
                url.search
            );


        displayEnvironment({
            host:
                url.hostname,

            baseUrl:
                url.origin,

            title:
                tab.title ||
                "Unknown",

            appId:
                params.get(
                    "appid"
                ),

            pageType:
                params.get(
                    "pagetype"
                ),

            entityName:
                params.get(
                    "etn"
                )
        });
    }
    catch (error) {

        console.error(
            "Environment detection error:",
            error
        );


        showEnvironmentError(
            error?.message ||
            String(error)
        );
    }
}


function displayEnvironment(
    response
) {

    setText(
        "environmentHost",
        response.host ||
        "Unknown"
    );

    setText(
        "environmentUrl",
        response.baseUrl ||
        "Unknown"
    );

    setText(
        "environmentTitle",
        response.title ||
        "Unknown"
    );

    setText(
        "entityName",
        response.entityName ||
        "Not detected"
    );

    setText(
        "pageType",
        response.pageType ||
        "Not detected"
    );

    setText(
        "appId",
        response.appId ||
        "Not detected"
    );
}


function showEnvironmentError(
    message
) {

    setText(
        "environmentHost",
        message
    );


    [
        "environmentUrl",
        "entityName",
        "pageType",
        "appId",
        "environmentTitle"
    ]
        .forEach(
            function (id) {

                setText(
                    id,
                    "-"
                );
            }
        );
}


// ============================================================
// DYNAMICS MESSAGING
// ============================================================

async function sendDynamicsMessage(
    message,
    callback,
    errorCallback
) {

    try {

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        if (!tabs.length) {

            errorCallback?.(
                "No active browser tab found."
            );

            return;
        }


        const tab = typeof rgWorkflow !== "undefined" && rgWorkflow.sourceTabId
            ? await chrome.tabs.get(rgWorkflow.sourceTabId)
            : tabs[0];


        if (
            !tab.url ||
            !tab.url.includes(
                "dynamics.com"
            )
        ) {

            errorCallback?.(
                "Active tab is not a Dynamics 365 page."
            );

            return;
        }


        chrome.tabs.sendMessage(
            tab.id,
            message,
            function (response) {

                if (
                    chrome.runtime.lastError
                ) {

                    const errorMessage =
                        chrome.runtime
                            .lastError
                            .message ||
                        "Unknown Chrome messaging error.";


                    console.error(
                        "Release Guardian message failed:",
                        errorMessage,
                        "Action:",
                        message.action
                    );


                    errorCallback?.(
                        errorMessage
                    );

                    return;
                }


                if (
                    response ===
                    undefined
                ) {

                    errorCallback?.(
                        `No response received for ${message.action}.`
                    );

                    return;
                }


                callback?.(
                    response
                );
            }
        );
    }
    catch (error) {

        const messageText =
            error?.message ||
            String(error);


        console.error(
            "Release Guardian messaging exception:",
            messageText
        );


        errorCallback?.(
            messageText
        );
    }
}


// ============================================================
// DATAVERSE CONNECTION
// ============================================================

async function testDataverseConnection() {

    const status =
        document.getElementById(
            "connectionStatus"
        );


    if (status) {

        status.textContent =
            "Testing...";
    }


    return new Promise(resolve => sendDynamicsMessage(
        {
            action:
                "whoAmI"
        },

        function (response) {

            if (
                !response?.success
            ) {

                if (status) {

                    status.textContent =
                        `Failed (${response?.status || "Unknown"})`;
                }

                resolve(false);
                return;
            }


            if (status) {

                status.textContent =
                    "Connected ✓";
            }


            setText(
                "userId",
                response.data?.UserId ||
                "-"
            );


            setText(
                "organizationId",
                response.data?.OrganizationId ||
                "-"
            );
            resolve(true);
        },

        function (message) {

            if (status) {

                status.textContent =
                    message ||
                    "Content script unavailable.";
            }
            resolve(false);
        }
    ));
}


// ============================================================
// SOLUTIONS
// ============================================================

async function loadSolutions() {
    if (typeof rgWorkflow !== "undefined" && rgWorkflow.initialized) rgWorkflow.resetAnalysis();

    const status =
        document.getElementById(
            "solutionStatus"
        );


    const select =
        document.getElementById(
            "solutionSelect"
        );


    if (status) {

        status.textContent =
            "Loading solutions...";
    }


    if (select) {

        select.innerHTML =
            '<option value="">Select a solution</option>';
    }


    resetSolutionState();


    return new Promise(resolve => sendDynamicsMessage(
        {
            action:
                "getSolutions"
        },

        function (response) {

            if (
                !response?.success
            ) {

                if (status) {

                    status.textContent =
                        `Failed (${response?.status || "Unknown"})`;
                }

                resolve(false);
                return;
            }


            loadedSolutions =
                response.solutions ||
                [];


            loadedSolutions.forEach(
                function (solution) {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        solution.solutionid;


                    option.textContent =
                        solution.friendlyname ||
                        solution.uniquename;


                    select?.appendChild(
                        option
                    );
                }
            );


            if (status) {

                status.textContent =
                    `${loadedSolutions.length} solutions found`;
            }
            resolve(true);
        },

        function (message) {

            if (status) {

                status.textContent =
                    message ||
                    "Unable to communicate with Dynamics.";
            }
            resolve(false);
        }
    ));
}


function solutionChanged() {

    const select =
        document.getElementById(
            "solutionSelect"
        );


    const solution =
        loadedSolutions.find(
            function (item) {

                return (
                    item.solutionid ===
                    select?.value
                );
            }
        );


    if (typeof rgWorkflow !== "undefined") rgWorkflow.resetAnalysis();

    resetAnalysisState();


    const details =
        document.getElementById(
            "solutionDetails"
        );


    const analyzeButton =
        document.getElementById(
            "analyzeSolutionButton"
        );


    if (!solution) {

        if (details) {

            details.style.display =
                "none";
        }


        if (analyzeButton) {

            analyzeButton.style.display =
                "none";
        }


        return;
    }


    setText(
        "solutionUniqueName",
        solution.uniquename ||
        "-"
    );


    setText(
        "solutionVersion",
        solution.version ||
        "-"
    );


    setText(
        "solutionType",
        solution.ismanaged
            ? "Managed"
            : "Unmanaged"
    );


    if (details) {

        details.style.display =
            "block";
    }


    if (analyzeButton) {

        analyzeButton.style.display =
            "block";
    }
}


// ============================================================
// ANALYZE SOLUTION
// ============================================================

async function analyzeSelectedSolution() {

    const solutionId =
        document.getElementById(
            "solutionSelect"
        )?.value;


    if (!solutionId) {

        return;
    }


    if (typeof rgWorkflow !== "undefined") rgWorkflow.analysisStarted(solutionId);

    const card =
        document.getElementById(
            "analysisCard"
        );


    const status =
        document.getElementById(
            "analysisStatus"
        );


    if (card) {

        card.style.display =
            "block";
    }


    if (status) {

        status.textContent =
            "Analyzing solution...";
    }


    resetComponentCounts();

    rg25ClearExplorerCache();


    sendDynamicsMessage(
        {
            action:
                "getSolutionComponents",

            solutionId
        },

        function (response) {
            if (document.getElementById("solutionSelect")?.value !== solutionId) return;

            if (
                !response?.success
            ) {

                if (status) {

                    status.textContent =
                        `Analysis failed (${response?.status || "Unknown"})`;
                }

                if (typeof rgWorkflow !== "undefined") rgWorkflow.analysisFinished(solutionId, false);
                return;
            }


            analyzedComponents =
                rgNormalizeSolutionInventory(
                    response.components ||
                    []
                );


            displayComponentSummary(
                analyzedComponents
            );


            rgShowScreen("solution");
            if (typeof rgWorkflow !== "undefined") rgWorkflow.analysisFinished(solutionId, true);

            setTimeout(
                function () {

                    rgAnalyzeSolutionReadiness();

                    rg25RebindSolutionSummary();

                    rg25AddExplorerShortcuts();

                    if (
                        typeof rg282UpdateSourceSolution ===
                        "function"
                    ) {

                        rg282UpdateSourceSolution();
                    }
                },
                100
            );
        },

        function (message) {
            if (document.getElementById("solutionSelect")?.value !== solutionId) return;
            if (typeof rgWorkflow !== "undefined") rgWorkflow.analysisFinished(solutionId, false);

            if (status) {

                status.textContent =
                    message ||
                    "Unable to communicate with Dynamics.";
            }
        }
    );
}


// ============================================================
// SOLUTION INVENTORY NORMALIZATION
//
// Keep a defensive client-side normalization as well. The content script
// already returns normalized solution components, but this protects counts
// when older cached responses or future callers provide raw rows.
// ============================================================

function rgNormalizeSolutionInventory(components) {

    const map = new Map();

    (components || []).forEach(component => {

        const type = Number(component?.componenttype);
        const objectId = String(component?.objectid || "").toLowerCase();
        const rowId = String(component?.solutioncomponentid || "").toLowerCase();
        const key = objectId
            ? `${type}:${objectId}`
            : `${type}:row:${rowId}`;

        const existing = map.get(key);

        if (!existing) {
            map.set(key, { ...component });
            return;
        }

        if (Number(component?.rootcomponentbehavior) === 0) {
            existing.rootcomponentbehavior = 0;
        }

        if (!existing.rootsolutioncomponentid && component?.rootsolutioncomponentid) {
            existing.rootsolutioncomponentid = component.rootsolutioncomponentid;
        }
    });

    return Array.from(map.values());
}


// ============================================================
// COMPONENT SUMMARY
// ============================================================

function displayComponentSummary(
    components
) {

    const counts = {
        tables: 0,
        columns: 0,
        forms: 0,
        views: 0,
        workflows: 0,
        webResources: 0,
        choices: 0,
        other: 0
    };


    components.forEach(
        function (component) {

            switch (
            component.componenttype
            ) {

                case 1:

                    counts.tables++;

                    break;


                case 2:

                    counts.columns++;

                    break;


                case 9:

                    counts.choices++;

                    break;


                case 26:

                    counts.views++;

                    break;


                case 29:

                    counts.workflows++;

                    break;


                case 60:

                    counts.forms++;

                    break;


                case 61:

                    counts.webResources++;

                    break;


                default:

                    counts.other++;

                    break;
            }
        }
    );


    setText(
        "totalComponents",
        components.length
    );

    setText(
        "tableCount",
        counts.tables
    );

    setText(
        "columnCount",
        counts.columns
    );

    setText(
        "formCount",
        counts.forms
    );

    setText(
        "viewCount",
        counts.views
    );

    setText(
        "workflowCount",
        counts.workflows
    );

    setText(
        "webResourceCount",
        counts.webResources
    );

    setText(
        "choiceCount",
        counts.choices
    );

    setText(
        "otherCount",
        counts.other
    );


    setText(
        "analysisStatus",
        "Analysis complete ✓"
    );
}


// ============================================================
// TABLE EXPLORER
// ============================================================

async function loadSolutionTables() {

    rgShowScreen(
        "explorer"
    );


    rg25ResetExplorerPreserveTables();


    const section =
        document.getElementById(
            "tableDetailsSection"
        );


    const status =
        document.getElementById(
            "tableDetailsStatus"
        );


    if (section) {

        section.style.display =
            "block";
    }


    if (
        !analyzedComponents.length
    ) {

        if (status) {

            status.textContent =
                "Analyze the solution first.";
        }

        return;
    }


    if (status) {

        status.textContent =
            "Resolving table names...";
    }


    const tableComponents =
        analyzedComponents.filter(
            function (component) {

                return (
                    component.componenttype ===
                    1
                );
            }
        );


    sendDynamicsMessage(
        {
            action:
                "getTableMetadata"
        },

        function (response) {

            if (
                !response?.success
            ) {

                if (status) {

                    status.textContent =
                        "Failed to retrieve table metadata.";
                }

                return;
            }


            resolveSolutionTables(
                tableComponents,
                response.tables ||
                []
            );
        },

        function (message) {

            if (status) {

                status.textContent =
                    message ||
                    "Unable to communicate with Dynamics.";
            }
        }
    );
}
function resolveSolutionTables(
    components,
    metadata
) {

    const metadataMap =
        new Map(
            metadata
                .filter(
                    function (table) {

                        return table.MetadataId;
                    }
                )
                .map(
                    function (table) {

                        return [
                            table.MetadataId
                                .toLowerCase(),

                            table
                        ];
                    }
                )
        );


    resolvedTables =
        components
            .map(
                function (component) {

                    if (
                        !component.objectid
                    ) {

                        return null;
                    }


                    const table =
                        metadataMap.get(
                            component.objectid
                                .toLowerCase()
                        );


                    if (!table) {

                        return {

                            metadataId:
                                component.objectid,

                            displayName:
                                "Unknown Table",

                            logicalName:
                                "-",

                            schemaName:
                                "-"
                        };
                    }


                    return {

                        metadataId:
                            table.MetadataId,

                        displayName:
                            getLocalizedLabel(
                                table.DisplayName
                            ) ||
                            table.LogicalName,

                        logicalName:
                            table.LogicalName,

                        schemaName:
                            table.SchemaName
                    };
                }
            )
            .filter(Boolean)
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.displayName
                        .localeCompare(
                            b.displayName
                        );
                }
            );


    setText(
        "tableDetailsStatus",
        `${resolvedTables.length} tables resolved`
    );


    renderTableList(
        resolvedTables
    );
}


function renderTableList(
    tables
) {

    const container =
        document.getElementById(
            "tableList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    if (
        !tables.length
    ) {

        container.innerHTML =
            "<p>No matching tables.</p>";

        return;
    }


    tables.forEach(
        function (table) {

            const row =
                createComponentRow(
                    true
                );


            row.addEventListener(
                "click",
                function () {

                    openTableInspector(
                        table
                    );
                }
            );


            appendTextElement(
                row,
                "strong",
                table.displayName
            );


            appendTextElement(
                row,
                "div",
                table.logicalName,
                "component-logical-name"
            );


            appendTextElement(
                row,
                "small",
                `Schema: ${table.schemaName}`
            );


            container.appendChild(
                row
            );
        }
    );
}


function filterTableList() {

    const search =
        getSearchValue(
            "tableSearch"
        );


    renderTableList(

        resolvedTables.filter(
            function (table) {

                return searchMatches(
                    search,
                    table.displayName,
                    table.logicalName,
                    table.schemaName
                );
            }
        )
    );
}


// ============================================================
// TABLE INSPECTOR
// ============================================================

async function openTableInspector(
    table
) {

    rgShowScreen(
        "explorer"
    );


    selectedTable =
        table;


    selectedColumn =
        null;


    clearTableComponentState();


    [
        "tableDetailsSection",
        "columnInspector",
        "componentInspector"
    ]
        .forEach(
            function (id) {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {

                    element.style.display =
                        "none";
                }
            }
        );


    const inspector =
        document.getElementById(
            "tableInspector"
        );


    if (inspector) {

        inspector.style.display =
            "block";
    }


    setText(
        "inspectorTableName",
        table.displayName
    );


    setText(
        "inspectorLogicalName",
        table.logicalName
    );


    setText(
        "tableInspectorStatus",
        "Loading columns, forms, views, relationships and processes..."
    );


    showTableComponentSection(
        "columns"
    );


    sendDynamicsMessage(
        {
            action:
                "getTableDetails",

            metadataId:
                table.metadataId,

            logicalName:
                table.logicalName
        },

        function (response) {

            if (
                !response?.success
            ) {

                setText(
                    "tableInspectorStatus",
                    `Failed (${response?.status || "Unknown"})`
                );

                return;
            }


            resolveTableInspectorData(
                response
            );
        },

        function (message) {

            setText(
                "tableInspectorStatus",
                message ||
                "Unable to communicate with Dynamics."
            );
        }
    );
}


function resolveTableInspectorData(
    response
) {

    const tableComponent =
        analyzedComponents.find(
            function (component) {

                return (
                    component.componenttype ===
                    1 &&

                    component.objectid &&

                    selectedTable?.metadataId &&

                    component.objectid
                        .toLowerCase() ===
                    selectedTable.metadataId
                        .toLowerCase()
                );
            }
        );


    tableIncludesSubcomponents =
        tableComponent
            ?.rootcomponentbehavior ===
        0;


    resolveColumns(
        response.columns ||
        []
    );


    resolveForms(
        response.forms ||
        []
    );


    resolveViews(
        response.views ||
        []
    );


    resolveRelationships(
        response.oneToMany ||
        [],

        response.manyToOne ||
        [],

        response.manyToMany ||
        []
    );


    resolveProcesses(
        response.processes ||
        []
    );


    setText(
        "tableInspectorStatus",

        tableIncludesSubcomponents

            ? "Components loaded ✓ • Table includes subcomponents"

            : "Components loaded ✓"
    );
}


// ============================================================
// SOLUTION MEMBERSHIP
// ============================================================

function getSolutionComponentIdSet(
    componentType
) {

    return new Set(

        analyzedComponents
            .filter(
                function (component) {

                    return (
                        component.componenttype ===
                        componentType &&

                        component.objectid
                    );
                }
            )
            .map(
                function (component) {

                    return component.objectid
                        .toLowerCase();
                }
            )
    );
}


function getMembership(
    id,
    explicitIds
) {

    if (
        id &&
        explicitIds.has(
            String(id)
                .toLowerCase()
        )
    ) {

        return "explicit";
    }


    if (
        tableIncludesSubcomponents
    ) {

        return "inherited";
    }


    return "notExplicit";
}


function getMembershipText(
    membership
) {

    if (
        membership ===
        "explicit"
    ) {

        return "✓ Explicitly included";
    }


    if (
        membership ===
        "inherited"
    ) {

        return "✓ Included through table";
    }


    return "○ Not explicitly included";
}


function appendMembership(
    parent,
    membership
) {

    const element =
        document.createElement(
            "div"
        );


    element.className =
        "membership-label";


    element.textContent =
        getMembershipText(
            membership
        );


    element.classList.add(

        membership ===
            "explicit"

            ? "membership-included"

            : membership ===
                "inherited"

                ? "membership-inherited"

                : "membership-not-included"
    );


    parent.appendChild(
        element
    );
}


// ============================================================
// COLUMNS
// ============================================================

function resolveColumns(
    columns
) {

    const explicitIds =
        getSolutionComponentIdSet(
            2
        );


    resolvedColumns =
        columns
            .map(
                function (column) {

                    return {

                        metadataId:
                            column.MetadataId ||
                            "",

                        displayName:
                            getLocalizedLabel(
                                column.DisplayName
                            ) ||
                            column.LogicalName ||
                            "Unnamed Column",

                        logicalName:
                            column.LogicalName ||
                            "-",

                        schemaName:
                            column.SchemaName ||
                            "-",

                        attributeType:
                            column.AttributeType ||
                            "Unknown",

                        isCustom:
                            column.IsCustomAttribute ===
                            true,

                        membership:
                            getMembership(
                                column.MetadataId,
                                explicitIds
                            )
                    };
                }
            )
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.displayName
                        .localeCompare(
                            b.displayName
                        );
                }
            );


    setText(
        "inspectorColumnCount",
        resolvedColumns.length
    );


    setText(
        "totalTableColumnCount",
        resolvedColumns.length
    );


    setText(
        "includedColumnCount",

        resolvedColumns.filter(
            function (column) {

                return (
                    column.membership ===
                    "explicit"
                );
            }
        ).length
    );


    setText(
        "effectiveColumnCount",

        resolvedColumns.filter(
            function (column) {

                return (
                    column.membership !==
                    "notExplicit"
                );
            }
        ).length
    );


    setText(
        "columnStatus",
        `${resolvedColumns.length} columns found`
    );


    activeColumnFilter =
        "all";


    updateColumnFilterButtons();

    applyColumnFilters();
}


function setColumnFilter(
    filter
) {

    activeColumnFilter =
        filter;


    updateColumnFilterButtons();

    applyColumnFilters();
}


function updateColumnFilterButtons() {

    const map = {

        all:
            "filterAllColumns",

        included:
            "filterIncludedColumns",

        notIncluded:
            "filterNotIncludedColumns"
    };


    Object
        .values(
            map
        )
        .forEach(
            function (id) {

                document
                    .getElementById(
                        id
                    )
                    ?.classList
                    .remove(
                        "active-filter"
                    );
            }
        );


    document
        .getElementById(
            map[
            activeColumnFilter
            ]
        )
        ?.classList
        .add(
            "active-filter"
        );
}


function filterColumnList() {

    applyColumnFilters();
}


function applyColumnFilters() {

    const search =
        getSearchValue(
            "columnSearch"
        );


    let columns =
        [
            ...resolvedColumns
        ];


    if (
        activeColumnFilter ===
        "included"
    ) {

        columns =
            columns.filter(
                function (column) {

                    return (
                        column.membership !==
                        "notExplicit"
                    );
                }
            );
    }


    if (
        activeColumnFilter ===
        "notIncluded"
    ) {

        columns =
            columns.filter(
                function (column) {

                    return (
                        column.membership ===
                        "notExplicit"
                    );
                }
            );
    }


    if (search) {

        columns =
            columns.filter(
                function (column) {

                    return searchMatches(
                        search,
                        column.displayName,
                        column.logicalName,
                        column.schemaName,
                        column.attributeType
                    );
                }
            );
    }


    renderColumnList(
        columns
    );
}


function renderColumnList(
    columns
) {

    const container =
        document.getElementById(
            "columnList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    if (
        !columns.length
    ) {

        container.innerHTML =
            "<p>No matching columns.</p>";

        return;
    }


    columns.forEach(
        function (column) {

            const row =
                createComponentRow(
                    true
                );


            row.addEventListener(
                "click",
                function () {

                    openColumnInspector(
                        column
                    );
                }
            );


            appendTextElement(
                row,
                "strong",
                column.displayName
            );


            appendTextElement(
                row,
                "div",
                column.logicalName,
                "component-logical-name"
            );


            appendTextElement(
                row,
                "small",
                `${column.attributeType} • ${column.isCustom
                    ? "Custom"
                    : "Standard"
                }`
            );


            appendMembership(
                row,
                column.membership
            );


            container.appendChild(
                row
            );
        }
    );
}


// ============================================================
// COLUMN INSPECTOR
// ============================================================

function openColumnInspector(
    column
) {

    selectedColumn =
        column;


    const tableInspector =
        document.getElementById(
            "tableInspector"
        );


    const columnInspector =
        document.getElementById(
            "columnInspector"
        );


    if (tableInspector) {

        tableInspector.style.display =
            "none";
    }


    if (columnInspector) {

        columnInspector.style.display =
            "block";
    }


    setText(
        "columnInspectorName",
        column.displayName
    );


    setText(
        "columnInspectorLogicalName",
        column.logicalName
    );


    setText(
        "columnInspectorSchema",
        column.schemaName
    );


    setText(
        "columnInspectorType",
        column.attributeType
    );


    setText(
        "columnInspectorSource",

        column.isCustom

            ? "Custom"

            : "Standard"
    );


    setText(
        "columnInspectorMembership",
        getMembershipText(
            column.membership
        )
    );


    setText(
        "columnInspectorMetadataId",
        column.metadataId ||
        "-"
    );


    analyzeColumnRisk(
        column
    );


    analyzeColumnUsage(
        column
    );


    if (
        typeof rgLoadColumnDependencies ===
        "function"
    ) {

        rgLoadColumnDependencies(
            column
        );
    }
}


function closeColumnInspector() {

    const columnInspector =
        document.getElementById(
            "columnInspector"
        );


    const tableInspector =
        document.getElementById(
            "tableInspector"
        );


    if (columnInspector) {

        columnInspector.style.display =
            "none";
    }


    if (tableInspector) {

        tableInspector.style.display =
            "block";
    }


    showTableComponentSection(
        "columns"
    );
}


function analyzeColumnRisk(
    column
) {

    let status =
        "Low";


    let reason =
        "No immediate deployment risk detected.";


    if (
        column.membership ===
        "notExplicit"
    ) {

        status =
            "Review";


        reason =
            "The column is not explicitly included in the selected solution.";
    }


    if (
        tableIncludesSubcomponents &&
        column.membership ===
        "inherited"
    ) {

        status =
            "Included";


        reason =
            "The parent table includes subcomponents, so this column is effectively part of the solution.";
    }


    setText(
        "columnRiskStatus",
        status
    );


    setText(
        "columnRiskReason",
        reason
    );
}


// ============================================================
// COLUMN USED BY
// ============================================================

function analyzeColumnUsage(
    column
) {

    const logicalName =
        String(
            column.logicalName ||
            ""
        )
            .toLowerCase()
            .trim();


    if (!logicalName) {

        clearUsedByResults();

        return;
    }


    // A raw logical-name hit anywhere in formxml does NOT necessarily mean
    // the field is placed on the form. Classify actual field controls
    // separately from other FormXML references.
    const formUsage =
        resolvedForms
            .map(
                function (form) {

                    return classifyColumnFormUsage(
                        form,
                        logicalName
                    );
                }
            )
            .filter(Boolean);


    const formMatches =
        formUsage.filter(
            function (usage) {

                return usage.kind === "onForm" ||
                    usage.kind === "hiddenOnForm";
            }
        );


    const formReferenceMatches =
        formUsage.filter(
            function (usage) {

                return usage.kind === "xmlReference";
            }
        );


    const viewMatches =
        resolvedViews
            .map(
                function (view) {

                    const locations = [];

                    if (
                        xmlAttributeReferencesColumn(
                            view.fetchXml,
                            logicalName,
                            [
                                "name",
                                "attribute"
                            ]
                        )
                    ) {

                        locations.push("FetchXML");
                    }

                    if (
                        xmlAttributeReferencesColumn(
                            view.layoutXml,
                            logicalName,
                            [
                                "name",
                                "attribute",
                                "datafieldname"
                            ]
                        )
                    ) {

                        locations.push("LayoutXML");
                    }

                    if (!locations.length) {

                        return null;
                    }

                    return {
                        ...view,
                        referenceLocations:
                            locations
                    };
                }
            )
            .filter(Boolean);


    const businessRuleMatches =
        resolvedBusinessRules
            .map(
                function (process) {

                    const locations = [];

                    if (
                        textContainsReference(
                            process.clientData,
                            logicalName
                        )
                    ) {

                        locations.push("ClientData");
                    }

                    if (
                        textContainsReference(
                            process.xaml,
                            logicalName
                        )
                    ) {

                        locations.push("XAML");
                    }

                    if (
                        textContainsReference(
                            process.triggerOnUpdateAttributeList,
                            logicalName
                        )
                    ) {

                        locations.push("Trigger attributes");
                    }

                    if (!locations.length) {

                        return null;
                    }

                    return {
                        ...process,
                        referenceLocations:
                            locations
                    };
                }
            )
            .filter(Boolean);


    // "Forms" now means actual field controls on a form, not arbitrary
    // occurrences of the logical name somewhere in FormXML.
    setText(
        "usedByFormCount",
        formMatches.length
    );


    setText(
        "usedByViewCount",
        viewMatches.length
    );


    setText(
        "usedByBusinessRuleCount",
        businessRuleMatches.length
    );


    const directTotal =
        formMatches.length +
        viewMatches.length +
        businessRuleMatches.length;


    setText(
        "usedByTotalCount",
        directTotal
    );


    const referenceSuffix =
        formReferenceMatches.length
            ? ` ${formReferenceMatches.length} additional FormXML reference(s) found but not counted as fields placed on forms.`
            : "";


    setText(
        "usedByStatus",

        directTotal

            ? `${directTotal} direct definition reference(s) detected.${referenceSuffix}`

            : `No direct form, view or Business Rule references detected.${referenceSuffix}`
    );


    renderUsedByList(
        formMatches,
        formReferenceMatches,
        viewMatches,
        businessRuleMatches
    );
}


function classifyColumnFormUsage(
    form,
    logicalName
) {

    const formXml =
        String(
            form?.formXml ||
            ""
        );


    if (!formXml) {

        return null;
    }


    const lowerXml =
        formXml.toLowerCase();


    if (
        !lowerXml.includes(
            logicalName
        )
    ) {

        return null;
    }


    const controlPattern =
        /<control\b[^>]*\bdatafieldname\s*=\s*["']([^"']+)["'][^>]*>/gi;


    let match;


    while (
        (
            match =
                controlPattern.exec(
                    formXml
                )
        ) !== null
    ) {

        if (
            String(
                match[1] ||
                ""
            )
                .toLowerCase() !==
            logicalName
        ) {

            continue;
        }


        const controlTag =
            match[0] ||
            "";


        const controlHidden =
            /\bvisible\s*=\s*["']false["']/i.test(
                controlTag
            );


        const contextStart =
            Math.max(
                0,
                match.index -
                2500
            );


        const context =
            formXml.slice(
                contextStart,
                match.index +
                controlTag.length
            );


        // FormXML can hide a field through its own control or a containing
        // cell/row/section. This is intentionally conservative: a definite
        // hidden marker becomes Hidden on form; otherwise it is On form.
        const containerHidden =
            /<(?:cell|row|section)\b[^>]*\bvisible\s*=\s*["']false["'][^>]*>[^<]*$/i.test(
                context
            );


        return {
            ...form,

            kind:
                controlHidden ||
                containerHidden
                    ? "hiddenOnForm"
                    : "onForm",

            usageLabel:
                controlHidden ||
                containerHidden
                    ? "Hidden on form"
                    : "On form"
        };
    }


    return {
        ...form,

        kind:
            "xmlReference",

        usageLabel:
            "Form XML reference"
    };
}


function xmlAttributeReferencesColumn(
    source,
    logicalName,
    attributeNames
) {

    if (
        !source ||
        !logicalName
    ) {

        return false;
    }


    const escapedName =
        escapeRegExp(
            logicalName
        );


    return (
        attributeNames ||
        []
    )
        .some(
            function (attributeName) {

                const escapedAttribute =
                    escapeRegExp(
                        attributeName
                    );


                const pattern =
                    new RegExp(
                        `\\b${escapedAttribute}\\s*=\\s*["']${escapedName}["']`,
                        "i"
                    );


                return pattern.test(
                    String(
                        source
                    )
                );
            }
        );
}


function escapeRegExp(
    value
) {

    return String(
        value ??
        ""
    )
        .replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
}


function clearUsedByResults() {

    setText(
        "usedByFormCount",
        0
    );


    setText(
        "usedByViewCount",
        0
    );


    setText(
        "usedByBusinessRuleCount",
        0
    );


    setText(
        "usedByTotalCount",
        0
    );


    setText(
        "usedByStatus",
        "No references analyzed."
    );


    rgClearElement(
        "usedByList"
    );
}


function renderUsedByList(
    forms,
    formReferences,
    views,
    businessRules
) {

    const container =
        document.getElementById(
            "usedByList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    const groups = [
        {
            title:
                "Forms",

            records:
                forms,

            name:
                item =>
                    item.name,

            detail:
                item =>
                    item.usageLabel ||
                    "On form"
        },
        {
            title:
                "Form XML References",

            records:
                formReferences,

            name:
                item =>
                    item.name,

            detail:
                item =>
                    item.usageLabel ||
                    "Referenced in FormXML"
        },
        {
            title:
                "Views",

            records:
                views,

            name:
                item =>
                    item.name,

            detail:
                item =>
                    (item.referenceLocations || [])
                        .join(" + ")
        },
        {
            title:
                "Business Rules",

            records:
                businessRules,

            name:
                item =>
                    item.name,

            detail:
                item =>
                    (item.referenceLocations || [])
                        .join(" + ")
        }
    ];


    groups.forEach(
        function (group) {

            if (
                !group.records.length
            ) {

                return;
            }


            const section = document.createElement("details");
            section.className = "rg4-reference-group";
            section.open = group.title !== "Form XML References";
            const heading = document.createElement("summary");
            heading.className = "used-by-heading";
            const title = document.createElement("span");
            title.textContent = group.title;
            const count = document.createElement("span");
            count.className = "rg4-group-count";
            count.textContent = String(group.records.length);
            heading.append(title, count);
            section.appendChild(heading);
            container.appendChild(section);


            group.records.forEach(
                function (record) {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "used-by-item";


                    const name =
                        document.createElement(
                            "div"
                        );


                    name.textContent =
                        group.name(
                            record
                        ) ||
                        "Unnamed component";


                    item.appendChild(
                        name
                    );


                    const detailText =
                        group.detail?.(
                            record
                        );


                    if (detailText) {

                        const detail =
                            document.createElement(
                                "small"
                            );


                        detail.textContent =
                            detailText;


                        item.appendChild(
                            detail
                        );
                    }


                    section.appendChild(
                        item
                    );
                }
            );
        }
    );
}


function textContainsReference(
    source,
    value
) {

    if (
        !source ||
        !value
    ) {

        return false;
    }


    return String(
        source
    )
        .toLowerCase()
        .includes(
            String(
                value
            )
                .toLowerCase()
        );
}


// ============================================================
// TABLE COMPONENT NAVIGATION
// ============================================================

function showTableComponentSection(
    section
) {

    currentTableSection =
        section;


    const sections = {

        columns:
            "columnsSection",

        forms:
            "formsSection",

        views:
            "viewsSection",

        relationships:
            "relationshipsSection",

        businessRules:
            "businessRulesSection",

        processes:
            "processesSection"
    };


    Object
        .values(
            sections
        )
        .forEach(
            function (id) {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {

                    element.style.display =
                        "none";
                }
            }
        );


    const current =
        document.getElementById(
            sections[
            section
            ]
        );


    if (current) {

        current.style.display =
            "block";
    }


    updateTableSectionButtons(
        section
    );
}


function updateTableSectionButtons(
    section
) {

    const buttons = {

        columns:
            "showColumnsButton",

        forms:
            "showFormsButton",

        views:
            "showViewsButton",

        relationships:
            "showRelationshipsButton",

        businessRules:
            "showBusinessRulesButton",

        processes:
            "showProcessesButton"
    };


    Object
        .entries(
            buttons
        )
        .forEach(
            function (
                [
                    key,
                    id
                ]
            ) {

                const button =
                    document.getElementById(
                        id
                    );


                if (!button) {

                    return;
                }


                button.classList.toggle(
                    "active-component-button",
                    key === section
                );
            }
        );
}


function closeTableInspector() {

    const tableInspector =
        document.getElementById(
            "tableInspector"
        );


    const tableSection =
        document.getElementById(
            "tableDetailsSection"
        );


    if (tableInspector) {

        tableInspector.style.display =
            "none";
    }


    if (tableSection) {

        tableSection.style.display =
            "block";
    }
}


function clearTableComponentState() {

    resolvedColumns =
        [];

    resolvedForms =
        [];

    resolvedViews =
        [];

    resolvedRelationships =
        [];

    resolvedBusinessRules =
        [];

    resolvedProcesses =
        [];


    [
        "columnList",
        "formsList",
        "viewsList",
        "relationshipsList",
        "businessRulesList",
        "processesList"
    ]
        .forEach(
            rgClearElement
        );


    [
        "inspectorColumnCount",
        "inspectorFormCount",
        "inspectorViewCount",
        "inspectorRelationshipCount",
        "inspectorBusinessRuleCount",
        "inspectorProcessCount"
    ]
        .forEach(
            function (id) {

                setText(
                    id,
                    0
                );
            }
        );
}
// ============================================================
// FORMS
// ============================================================

function resolveForms(
    forms
) {

    const explicitIds =
        getSolutionComponentIdSet(
            60
        );


    resolvedForms =
        forms
            .map(
                function (form) {

                    return {

                        id:
                            form.formid ||
                            "",

                        name:
                            form.name ||
                            "Unnamed Form",

                        uniqueName:
                            form.uniquename ||
                            "",

                        type:
                            form.type,

                        table:
                            form.objecttypecode ||
                            selectedTable?.logicalName ||
                            "",

                        isManaged:
                            form.ismanaged ===
                            true,

                        formXml:
                            form.formxml ||
                            "",

                        membership:
                            getMembership(
                                form.formid,
                                explicitIds
                            )
                    };
                }
            )
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.name.localeCompare(
                        b.name
                    );
                }
            );


    setText(
        "inspectorFormCount",
        resolvedForms.length
    );


    setText(
        "formsStatus",
        `${resolvedForms.length} forms found`
    );


    renderFormsFiltered();
}


function renderFormsFiltered() {

    const search =
        getSearchValue(
            "formsSearch"
        );


    renderForms(

        resolvedForms.filter(
            function (form) {

                return searchMatches(
                    search,
                    form.name,
                    form.uniqueName,
                    form.table,
                    getFormTypeName(
                        form.type
                    )
                );
            }
        )
    );
}


function renderForms(
    forms
) {

    const container =
        document.getElementById(
            "formsList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    if (
        !forms.length
    ) {

        container.innerHTML =
            "<p>No matching forms.</p>";

        return;
    }


    forms.forEach(
        function (form) {

            const row =
                createComponentRow(
                    true
                );


            row.addEventListener(
                "click",
                function () {

                    openComponentInspector(
                        "form",
                        form
                    );
                }
            );


            appendTextElement(
                row,
                "strong",
                form.name
            );


            if (
                form.uniqueName
            ) {

                appendTextElement(
                    row,
                    "div",
                    form.uniqueName,
                    "component-logical-name"
                );
            }


            appendTextElement(
                row,
                "small",

                `${getFormTypeName(
                    form.type
                )} • ${form.isManaged
                    ? "Managed"
                    : "Unmanaged"
                }`
            );


            appendMembership(
                row,
                form.membership
            );


            container.appendChild(
                row
            );
        }
    );
}


// ============================================================
// VIEWS
// ============================================================

function resolveViews(
    views
) {

    const explicitIds =
        getSolutionComponentIdSet(
            26
        );


    resolvedViews =
        views
            .map(
                function (view) {

                    return {

                        id:
                            view.savedqueryid ||
                            "",

                        name:
                            view.name ||
                            "Unnamed View",

                        table:
                            view.returnedtypecode ||
                            selectedTable?.logicalName ||
                            "",

                        queryType:
                            view.querytype,

                        stateCode:
                            view.statecode,

                        isDefault:
                            view.isdefault ===
                            true,

                        isQuickFind:
                            view.isquickfindquery ===
                            true,

                        fetchXml:
                            view.fetchxml ||
                            "",

                        layoutXml:
                            view.layoutxml ||
                            "",

                        membership:
                            getMembership(
                                view.savedqueryid,
                                explicitIds
                            )
                    };
                }
            )
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.name.localeCompare(
                        b.name
                    );
                }
            );


    setText(
        "inspectorViewCount",
        resolvedViews.length
    );


    setText(
        "viewsStatus",
        `${resolvedViews.length} views found`
    );


    renderViewsFiltered();
}


function renderViewsFiltered() {

    const search =
        getSearchValue(
            "viewsSearch"
        );


    renderViews(

        resolvedViews.filter(
            function (view) {

                return searchMatches(
                    search,
                    view.name,
                    view.table,
                    getViewTypeName(
                        view
                    )
                );
            }
        )
    );
}


function renderViews(
    views
) {

    const container =
        document.getElementById(
            "viewsList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    if (
        !views.length
    ) {

        container.innerHTML =
            "<p>No matching views.</p>";

        return;
    }


    views.forEach(
        function (view) {

            const row =
                createComponentRow(
                    true
                );


            row.addEventListener(
                "click",
                function () {

                    openComponentInspector(
                        "view",
                        view
                    );
                }
            );


            appendTextElement(
                row,
                "strong",
                view.name
            );


            appendTextElement(
                row,
                "div",
                view.table,
                "component-logical-name"
            );


            appendTextElement(
                row,
                "small",
                getViewTypeName(
                    view
                )
            );


            appendMembership(
                row,
                view.membership
            );


            container.appendChild(
                row
            );
        }
    );
}


// ============================================================
// RELATIONSHIPS
// ============================================================

function resolveRelationships(
    oneToMany,
    manyToOne,
    manyToMany
) {

    const explicitIds =
        getSolutionComponentIdSet(
            10
        );


    const normalized =
        [];


    oneToMany.forEach(
        function (relationship) {

            normalized.push({

                id:
                    relationship.MetadataId ||
                    "",

                schemaName:
                    relationship.SchemaName ||
                    "Unnamed Relationship",

                type:
                    "1:N",

                referencedEntity:
                    relationship.ReferencedEntity ||
                    "",

                referencingEntity:
                    relationship.ReferencingEntity ||
                    "",

                referencingAttribute:
                    relationship.ReferencingAttribute ||
                    "",

                intersectEntity:
                    "",

                membership:
                    getMembership(
                        relationship.MetadataId,
                        explicitIds
                    )
            });
        }
    );


    manyToOne.forEach(
        function (relationship) {

            normalized.push({

                id:
                    relationship.MetadataId ||
                    "",

                schemaName:
                    relationship.SchemaName ||
                    "Unnamed Relationship",

                type:
                    "N:1",

                referencedEntity:
                    relationship.ReferencedEntity ||
                    "",

                referencingEntity:
                    relationship.ReferencingEntity ||
                    "",

                referencingAttribute:
                    relationship.ReferencingAttribute ||
                    "",

                intersectEntity:
                    "",

                membership:
                    getMembership(
                        relationship.MetadataId,
                        explicitIds
                    )
            });
        }
    );


    manyToMany.forEach(
        function (relationship) {

            normalized.push({

                id:
                    relationship.MetadataId ||
                    "",

                schemaName:
                    relationship.SchemaName ||
                    "Unnamed Relationship",

                type:
                    "N:N",

                referencedEntity:
                    relationship.Entity1LogicalName ||
                    "",

                referencingEntity:
                    relationship.Entity2LogicalName ||
                    "",

                referencingAttribute:
                    "",

                intersectEntity:
                    relationship.IntersectEntityName ||
                    "",

                membership:
                    getMembership(
                        relationship.MetadataId,
                        explicitIds
                    )
            });
        }
    );


    const unique =
        new Map();


    normalized.forEach(
        function (relationship) {

            const key =
                relationship.id ||
                [
                    relationship.schemaName,
                    relationship.type
                ].join(
                    "|"
                );


            if (
                !unique.has(
                    key
                )
            ) {

                unique.set(
                    key,
                    relationship
                );
            }
        }
    );


    resolvedRelationships =
        [
            ...unique.values()
        ]
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.schemaName.localeCompare(
                        b.schemaName
                    );
                }
            );


    setText(
        "inspectorRelationshipCount",
        resolvedRelationships.length
    );


    setText(
        "relationshipsStatus",
        `${resolvedRelationships.length} relationships found`
    );


    renderRelationshipsFiltered();
}


function renderRelationshipsFiltered() {

    const search =
        getSearchValue(
            "relationshipsSearch"
        );


    renderRelationships(

        resolvedRelationships.filter(
            function (
                relationship
            ) {

                return searchMatches(
                    search,
                    relationship.schemaName,
                    relationship.type,
                    relationship.referencedEntity,
                    relationship.referencingEntity,
                    relationship.referencingAttribute,
                    relationship.intersectEntity
                );
            }
        )
    );
}


function renderRelationships(
    relationships
) {

    const container =
        document.getElementById(
            "relationshipsList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    if (
        !relationships.length
    ) {

        container.innerHTML =
            "<p>No matching relationships.</p>";

        return;
    }


    relationships.forEach(
        function (
            relationship
        ) {

            const row =
                createComponentRow(
                    true
                );


            row.addEventListener(
                "click",
                function () {

                    openComponentInspector(
                        "relationship",
                        relationship
                    );
                }
            );


            appendTextElement(
                row,
                "strong",
                relationship.schemaName
            );


            appendTextElement(
                row,
                "small",
                relationship.type
            );


            const description =
                relationship.type ===
                    "N:N"

                    ? `${relationship.referencedEntity} ↔ ${relationship.referencingEntity}`

                    : `${relationship.referencingEntity} → ${relationship.referencedEntity}`;


            appendTextElement(
                row,
                "div",
                description,
                "component-logical-name"
            );


            appendMembership(
                row,
                relationship.membership
            );


            container.appendChild(
                row
            );
        }
    );
}


// ============================================================
// PROCESSES / BUSINESS RULES
// ============================================================

function resolveProcesses(
    processes
) {

    const explicitIds =
        getSolutionComponentIdSet(
            29
        );


    const normalized =
        processes.map(
            function (process) {

                return {

                    id:
                        process.workflowid ||
                        "",

                    uniqueId:
                        process.workflowidunique ||
                        "",

                    name:
                        process.name ||
                        "Unnamed Process",

                    category:
                        process.category,

                    primaryEntity:
                        process.primaryentity ||
                        "",

                    stateCode:
                        process.statecode,

                    statusCode:
                        process.statuscode,

                    mode:
                        process.mode,

                    onDemand:
                        process.ondemand ===
                        true,

                    modernFlowType:
                        process.modernflowtype,

                    componentState:
                        process.componentstate,

                    isManaged:
                        process.ismanaged ===
                        true,

                    modifiedOn:
                        process.modifiedon ||
                        null,

                    clientData:
                        process.clientdata ||
                        "",

                    xaml:
                        process.xaml ||
                        "",

                    membership:
                        getMembership(
                            process.workflowid,
                            explicitIds
                        )
                };
            }
        );


    const unique =
        new Map();


    normalized.forEach(
        function (process) {

            const key =
                process.uniqueId ||
                process.id ||
                [
                    process.name,
                    process.category,
                    process.primaryEntity
                ]
                    .join(
                        "|"
                    )
                    .toLowerCase();


            const existing =
                unique.get(
                    key
                );


            if (!existing) {

                unique.set(
                    key,
                    process
                );

                return;
            }


            if (
                process.componentState ===
                0 &&
                existing.componentState !==
                0
            ) {

                unique.set(
                    key,
                    process
                );
            }
        }
    );


    const all =
        [
            ...unique.values()
        ]
            .sort(
                function (
                    a,
                    b
                ) {

                    return a.name.localeCompare(
                        b.name
                    );
                }
            );


    resolvedBusinessRules =
        all.filter(
            function (process) {

                return (
                    process.category ===
                    2
                );
            }
        );


    resolvedProcesses =
        all.filter(
            function (process) {

                return (
                    process.category !==
                    2
                );
            }
        );


    setText(
        "inspectorBusinessRuleCount",
        resolvedBusinessRules.length
    );


    setText(
        "inspectorProcessCount",
        resolvedProcesses.length
    );


    setText(
        "businessRulesStatus",
        `${resolvedBusinessRules.length} Business Rule(s) found`
    );


    setText(
        "processesStatus",
        `${resolvedProcesses.length} other process(es) found`
    );


    renderBusinessRulesFiltered();

    renderProcessesFiltered();
}


function renderBusinessRulesFiltered() {

    const search =
        getSearchValue(
            "businessRulesSearch"
        );


    renderProcessRecords(

        "businessRulesList",

        resolvedBusinessRules.filter(
            function (process) {

                return searchMatches(
                    search,
                    process.name,
                    process.primaryEntity,
                    getProcessCategoryName(
                        process.category
                    ),
                    getWorkflowStateName(
                        process.stateCode
                    )
                );
            }
        ),

        "businessRules"
    );
}


function renderProcessesFiltered() {

    const search =
        getSearchValue(
            "processesSearch"
        );


    renderProcessRecords(

        "processesList",

        resolvedProcesses.filter(
            function (process) {

                return searchMatches(
                    search,
                    process.name,
                    process.primaryEntity,
                    getProcessCategoryName(
                        process.category
                    ),
                    getWorkflowStateName(
                        process.stateCode
                    )
                );
            }
        ),

        "processes"
    );
}


function renderProcessRecords(
    containerId,
    records,
    kind
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    if (
        !records.length
    ) {

        container.innerHTML =
            "<p>No matching processes.</p>";

        return;
    }


    records.forEach(
        function (process) {

            const row =
                createComponentRow(
                    true
                );


            row.addEventListener(
                "click",
                function () {

                    componentInspectorReturnSection =
                        kind;


                    openComponentInspector(
                        "process",
                        process
                    );
                }
            );


            appendTextElement(
                row,
                "strong",
                process.name
            );


            if (
                process.primaryEntity
            ) {

                appendTextElement(
                    row,
                    "div",
                    process.primaryEntity,
                    "component-logical-name"
                );
            }


            appendTextElement(
                row,
                "small",

                `${getProcessCategoryName(
                    process.category
                )} • ${getWorkflowStateName(
                    process.stateCode
                )}`
            );


            appendMembership(
                row,
                process.membership
            );


            container.appendChild(
                row
            );
        }
    );
}
// ============================================================
// DATAVERSE DEPENDENCIES
// ============================================================

function rgAnalyzeComponentDependencies(
    objectId,
    componentType
) {

    rgCurrentDependencyBundle = {
        dependents: [],
        required: []
    };


    if (
        !objectId ||
        rg25IsZeroGuid(
            objectId
        )
    ) {

        return;
    }


    sendDynamicsMessage(
        {
            action:
                "getDependencyBundle",

            objectId,

            componentType
        },

        function (response) {

            if (
                !response?.success
            ) {

                return;
            }


            rgCurrentDependencyBundle = {

                dependents:
                    response.dependents ||
                    [],

                required:
                    response.required ||
                    []
            };
        }
    );
}


function rgLoadColumnDependencies(
    column
) {

    const panel =
        document.getElementById(
            "rgColumnDependencyPanel"
        );


    if (!panel) {

        return;
    }


    const status =
        document.getElementById(
            "rgColumnDependencyStatus"
        );


    const summary =
        document.getElementById(
            "rgColumnDependencySummary"
        );


    const list =
        document.getElementById(
            "rgColumnDependencyList"
        );


    if (status) {

        status.textContent =
            "Loading Dataverse dependencies...";
    }


    if (summary) {

        summary.style.display =
            "none";
    }


    if (list) {

        list.innerHTML =
            "";
    }


    if (
        !column?.metadataId ||
        rg25IsZeroGuid(
            column.metadataId
        )
    ) {

        if (status) {

            status.textContent =
                "Column metadata ID is unavailable.";
        }

        return;
    }


    sendDynamicsMessage(
        {
            action:
                "getDependencyBundle",

            objectId:
                column.metadataId,

            componentType:
                2
        },

        function (response) {

            if (
                !response?.success
            ) {

                if (status) {

                    status.textContent =
                        "Dependency lookup failed.";
                }

                return;
            }


            const dependents =
                response.dependents ||
                [];


            const required =
                response.required ||
                [];


            setText(
                "rgColumnUsedByCount",
                dependents.length
            );


            setText(
                "rgColumnDependsOnCount",
                required.length
            );


            if (summary) {

                summary.style.display =
                    "grid";
            }


            if (status) {

                status.textContent =
                    "Dependency graph loaded from Dataverse.";
            }


            rgRenderColumnDependencyRows(
                dependents,
                required
            );
        },

        function (message) {

            if (status) {

                status.textContent =
                    message ||
                    "Dependency lookup unavailable.";
            }
        }
    );
}


async function rgRenderColumnDependencyRows(
    dependents,
    required
) {

    const renderVersion = (rgRenderColumnDependencyRows.version || 0) + 1;
    rgRenderColumnDependencyRows.version = renderVersion;
    const inspectedColumn = selectedColumn;
    const container =
        document.getElementById(
            "rgColumnDependencyList"
        );


    if (!container) {

        return;
    }


    container.innerHTML =
        "";


    const rows = [

        ...dependents.map(
            function (dependency) {

                return {

                    direction:
                        "Used By",

                    componentType:
                        dependency.dependentcomponenttype,

                    objectId:
                        dependency.dependentcomponentobjectid,

                    parentId: dependency.dependentcomponentparentid,
                    dependencyType:
                        dependency.dependencytype
                };
            }
        ),

        ...required.map(
            function (dependency) {

                return {

                    direction:
                        "Depends On",

                    componentType:
                        dependency.requiredcomponenttype,

                    objectId:
                        dependency.requiredcomponentobjectid,

                    parentId: dependency.requiredcomponentparentid,
                    dependencyType:
                        dependency.dependencytype
                };
            }
        )
    ];


    if (!rows.length) {

        container.innerHTML = `

            <div class="rg-no-dependency">

                No direct Dataverse dependency records were returned.

            </div>
        `;

        return;
    }


    container.innerHTML = `

        <div class="rg-no-dependency">
            Resolving dependency component names...
        </div>
    `;


    let explorerData =
        rg25ExplorerData;


    try {

        explorerData =
            await rg25LoadExplorerData();
    }
    catch (error) {

        // The dependency graph itself is still valid even when the selected
        // solution explorer cannot resolve every component name.
        explorerData =
            rg25ExplorerData;
    }


    const unresolved = rows.filter(item => !rgResolveDependencyIdentity(
        item.objectId, item.componentType, explorerData)?.name);
    let displayNames = {};
    let typeLabels = {};
    let diagnostics = {};
    if (unresolved.length) {
        const result = await new Promise(resolve => {
            sendDynamicsMessage({ action: "getDependencyDisplayNames", dependencies: unresolved },
                response => resolve(response), () => resolve(null));
        });
        if (result?.success) {
            displayNames = result.identities || {};
            typeLabels = result.typeLabels || {};
            diagnostics = result.diagnostics || {};
        }
    }
    // A slower response from a previously opened column must not replace this one.
    if (renderVersion !== rgRenderColumnDependencyRows.version || selectedColumn !== inspectedColumn) return;

    container.innerHTML =
        "";


    // Keep direction and component type as separate levels of evidence.
    const groups = [
        { name: "Forms", types: [24, 60] },
        { name: "Views", types: [26] },
        { name: "Workflows / Business Rules", types: [29] },
        { name: "Columns", types: [2] },
        { name: "Charts", types: [59] },
        { name: "Plug-in Steps", types: [92] },
        { name: "Other", types: [] }
    ];
    const knownTypes = new Set(groups.flatMap(group => group.types));

    function createSection(label, count, className, open) {
        const section = document.createElement("details");
        section.className = className;
        section.open = open;
        const heading = document.createElement("summary");
        const name = document.createElement("span");
        name.textContent = label;
        const badge = document.createElement("span");
        badge.className = "rg4-group-count";
        badge.textContent = String(count);
        heading.append(name, badge);
        section.appendChild(heading);
        return section;
    }

    for (const direction of ["Used By", "Depends On"]) {
        const directionRows = rows.filter(item => item.direction === direction);
        if (!directionRows.length) continue;
        const section = createSection(direction, directionRows.length,
            "rg4-reference-group rg4-dependency-group", true);
        container.appendChild(section);

        for (const group of groups) {
            const items = directionRows.filter(item => group.types.length
                ? group.types.includes(Number(item.componentType))
                : !knownTypes.has(Number(item.componentType)));
            if (!items.length) continue;
            const typeSection = createSection(group.name, items.length,
                "rg4-reference-group rg41-dependency-type", false);
            section.appendChild(typeSection);

            for (const item of items) {
                const identity = rgResolveDependencyIdentity(
                    item.objectId, item.componentType, explorerData) ||
                    displayNames[`${Number(item.componentType)}:${String(item.objectId || "").replace(/[{}]/g, "").trim().toLowerCase()}`];
                const lookupKey = `${Number(item.componentType)}:${String(item.objectId || "").replace(/[{}]/g, "").trim().toLowerCase()}`;
                const diagnostic = diagnostics[lookupKey];
                const reason = {
                    access_denied: "Dataverse denied access to this record family.",
                    lookup_failed: "The name lookup failed; the dependency remains valid.",
                    ambiguous: "Multiple records matched; no name was selected.",
                    not_retrieved: "No named record was returned. This does not prove it is missing.",
                    unsupported_type: "Name lookup is not supported for this component type."
                }[diagnostic?.code] || "Name unavailable from the current lookup.";
                const typeText = typeLabels[item.componentType] || rgComponentTypeName(item.componentType);
                const row = document.createElement("div");
                row.className = "rg-dependency-item";
                const primaryText = identity?.name || `Unresolved ${typeText}`;
                const context = [identity?.context, rgDependencyTypeName(item.dependencyType)]
                    .filter(Boolean).join(" • ");
                row.innerHTML = `
                    <span class="rg41-dependency-name">${rgEscapeHtml(primaryText)}</span>
                    <small>${rgEscapeHtml(context)}</small>
                    <details class="rg-dependency-technical">
                        <summary>Technical details</summary>
                        <dl>
                            ${!identity?.name ? `<dt>Name resolution</dt><dd>${rgEscapeHtml(reason)}${diagnostic?.status ? ` (HTTP ${rgEscapeHtml(diagnostic.status)})` : ""}</dd>` : ""}
                            <dt>Component type</dt>
                            <dd>${rgEscapeHtml(typeText)} (${rgEscapeHtml(item.componentType)})</dd>
                            <dt>Component ID</dt>
                            <dd><code>${rgEscapeHtml(item.objectId || "Not provided")}</code></dd>
                        </dl>
                    </details>
                `;
                typeSection.appendChild(row);
            }
        }
    }
}


// ============================================================
// COMPONENT NAME RESOLUTION
// ============================================================

function rgResolveDependencyIdentity(
    objectId,
    componentType,
    explorerData
) {

    if (!objectId) {

        return null;
    }


    const normalized =
        String(
            objectId
        )
            .toLowerCase();


    const local =
        rgResolveKnownComponentIdentity(
            normalized,
            componentType
        );


    if (local) {

        return local;
    }


    const data =
        explorerData ||
        {};


    function sameId(
        value
    ) {

        return (
            value &&
            String(
                value
            )
                .toLowerCase() ===
            normalized
        );
    }


    switch (
    Number(
        componentType
    )
    ) {

        case 24:
        case 60: {

            const record =
                (data.forms || [])
                    .find(
                        item =>
                            sameId(
                                item.formid
                            )
                    );


            return record
                ? {
                    name:
                        record.name ||
                        record.uniquename ||
                        "Form",

                    context:
                        [
                            record.objecttypecode ||
                                null,

                            getFormTypeName(
                                record.type
                            )
                        ]
                            .filter(Boolean)
                            .join(" • ")
                }
                : null;
        }


        case 26: {

            const record =
                (data.views || [])
                    .find(
                        item =>
                            sameId(
                                item.savedqueryid
                            )
                    );


            return record
                ? {
                    name:
                        record.name ||
                        "View",

                    context:
                        record.returnedtypecode ||
                        ""
                }
                : null;
        }


        case 29: {

            const record =
                (data.workflows || [])
                    .find(
                        item =>
                            sameId(
                                item.workflowid
                            ) ||
                            sameId(
                                item.workflowidunique
                            )
                    );


            return record
                ? {
                    name:
                        record.name ||
                        record.uniquename ||
                        "Workflow / Process",

                    context:
                        [
                            record.primaryentity ||
                                null,

                            getProcessCategoryName(
                                record.category
                            )
                        ]
                            .filter(Boolean)
                            .join(" • ")
                }
                : null;
        }


        case 61: {

            const record =
                (data.webResources || [])
                    .find(
                        item =>
                            sameId(
                                item.webresourceid
                            )
                    );


            return record
                ? {
                    name:
                        record.name ||
                        record.displayname ||
                        "Web Resource",

                    context:
                        record.displayname ||
                        ""
                }
                : null;
        }


        case 90: {

            const record =
                (data.pluginTypes || [])
                    .find(
                        item =>
                            sameId(
                                item.plugintypeid
                            )
                    );


            return record
                ? {
                    name:
                        record.typename ||
                        record.name ||
                        "Plug-in Type",

                    context:
                        record.friendlyname ||
                        ""
                }
                : null;
        }


        case 91: {

            const record =
                (data.pluginAssemblies || [])
                    .find(
                        item =>
                            sameId(
                                item.pluginassemblyid
                            )
                    );


            return record
                ? {
                    name:
                        record.name ||
                        "Plug-in Assembly",

                    context:
                        record.version ||
                        ""
                }
                : null;
        }


        case 92: {

            const record =
                (data.pluginSteps || [])
                    .find(
                        item =>
                            sameId(
                                item.sdkmessageprocessingstepid
                            )
                    );


            return record
                ? {
                    name:
                        record.name ||
                        "Plug-in Step",

                    context:
                        [
                            typeof rg25PluginStage ===
                                "function"
                                ? rg25PluginStage(
                                    record.stage
                                )
                                : null,

                            typeof rg25PluginMode ===
                                "function"
                                ? rg25PluginMode(
                                    record.mode
                                )
                                : null
                        ]
                            .filter(Boolean)
                            .join(" • ")
                }
                : null;
        }


        case 371: {

            const record =
                (data.connectionReferences || [])
                    .find(
                        item =>
                            sameId(
                                item.connectionreferenceid
                            )
                    );


            return record
                ? {
                    name:
                        record.connectionreferencelogicalname ||
                        record.displayname ||
                        "Connection Reference",

                    context:
                        record.displayname ||
                        ""
                }
                : null;
        }


        case 380: {

            const record =
                (data.environmentVariables || [])
                    .find(
                        item =>
                            sameId(
                                item.environmentvariabledefinitionid
                            )
                    );


            return record
                ? {
                    name:
                        record.schemaname ||
                        record.displayname ||
                        "Environment Variable",

                    context:
                        record.displayname ||
                        ""
                }
                : null;
        }


        default:

            return null;
    }
}


function rgResolveKnownComponentIdentity(
    normalizedObjectId,
    componentType
) {

    const normalized =
        String(
            normalizedObjectId ||
            ""
        )
            .toLowerCase();


    switch (
    Number(
        componentType
    )
    ) {

        case 1: {

            const record =
                resolvedTables.find(
                    table =>
                        String(
                            table.metadataId ||
                            ""
                        )
                            .toLowerCase() ===
                        normalized
                );


            return record
                ? {
                    name:
                        record.displayName ||
                        record.logicalName,

                    context:
                        record.logicalName ||
                        ""
                }
                : null;
        }


        case 2: {

            const record =
                resolvedColumns.find(
                    column =>
                        String(
                            column.metadataId ||
                            ""
                        )
                            .toLowerCase() ===
                        normalized
                );


            return record
                ? {
                    name:
                        record.displayName ||
                        record.logicalName,

                    context:
                        [
                            selectedTable?.displayName ||
                                selectedTable?.logicalName ||
                                null,

                            record.logicalName ||
                                null
                        ]
                            .filter(Boolean)
                            .join(" • ")
                }
                : null;
        }


        case 24:
        case 60: {

            const record =
                resolvedForms.find(
                    form =>
                        String(
                            form.id ||
                            ""
                        )
                            .toLowerCase() ===
                        normalized
                );


            return record
                ? {
                    name:
                        record.name,

                    context:
                        [
                            record.table ||
                                null,

                            getFormTypeName(
                                record.type
                            )
                        ]
                            .filter(Boolean)
                            .join(" • ")
                }
                : null;
        }


        case 26: {

            const record =
                resolvedViews.find(
                    view =>
                        String(
                            view.id ||
                            ""
                        )
                            .toLowerCase() ===
                        normalized
                );


            return record
                ? {
                    name:
                        record.name,

                    context:
                        record.table ||
                        ""
                }
                : null;
        }


        case 29: {

            const record =
                [
                    ...resolvedBusinessRules,
                    ...resolvedProcesses
                ]
                    .find(
                        process =>
                            String(
                                process.id ||
                                ""
                            )
                                .toLowerCase() ===
                            normalized
                    );


            return record
                ? {
                    name:
                        record.name,

                    context:
                        [
                            record.primaryEntity ||
                                null,

                            getProcessCategoryName(
                                record.category
                            )
                        ]
                            .filter(Boolean)
                            .join(" • ")
                }
                : null;
        }


        default:

            return null;
    }
}


function rgResolveKnownComponentName(
    objectId,
    componentType
) {

    if (!objectId) {

        return null;
    }


    return (
        rgResolveKnownComponentIdentity(
            String(
                objectId
            )
                .toLowerCase(),
            componentType
        )
            ?.name ||
        null
    );
}


// ============================================================
// GENERIC COMPONENT INSPECTOR
// ============================================================

function openComponentInspector(
    kind,
    item
) {

    if (!item) {

        return;
    }


    const tableInspector =
        document.getElementById(
            "tableInspector"
        );


    const inspector =
        document.getElementById(
            "componentInspector"
        );


    if (tableInspector) {

        tableInspector.style.display =
            "none";
    }


    if (inspector) {

        inspector.style.display =
            "block";
    }


    let name =
        "Component";


    let kindText =
        kind;


    let type =
        "-";


    let status =
        "-";


    let membership =
        "-";


    let id =
        "-";


    let details =
        "-";


    if (
        kind ===
        "form"
    ) {

        name =
            item.name;


        kindText =
            "Form";


        type =
            getFormTypeName(
                item.type
            );


        status =
            item.isManaged
                ? "Managed"
                : "Unmanaged";


        membership =
            getMembershipText(
                item.membership
            );


        id =
            item.id ||
            "-";


        details =
            [
                item.table
                    ? `Table: ${item.table}`
                    : null,

                item.uniqueName
                    ? `Unique Name: ${item.uniqueName}`
                    : null
            ]
                .filter(Boolean)
                .join(
                    " • "
                ) ||
            "-";


        componentInspectorReturnSection =
            "forms";
    }


    else if (
        kind ===
        "view"
    ) {

        name =
            item.name;


        kindText =
            "View";


        type =
            getViewTypeName(
                item
            );


        status =
            item.stateCode ===
                0
                ? "Active"
                : "Inactive";


        membership =
            getMembershipText(
                item.membership
            );


        id =
            item.id ||
            "-";


        details =
            item.table
                ? `Table: ${item.table}`
                : "-";


        componentInspectorReturnSection =
            "views";
    }


    else if (
        kind ===
        "relationship"
    ) {

        name =
            item.schemaName;


        kindText =
            "Relationship";


        type =
            item.type;


        status =
            "-";


        membership =
            getMembershipText(
                item.membership
            );


        id =
            item.id ||
            "-";


        if (
            item.type ===
            "N:N"
        ) {

            details =
                `${item.referencedEntity} ↔ ${item.referencingEntity}`;


            if (
                item.intersectEntity
            ) {

                details +=
                    ` • Intersect: ${item.intersectEntity}`;
            }
        }
        else {

            details =
                `${item.referencingEntity} → ${item.referencedEntity}`;


            if (
                item.referencingAttribute
            ) {

                details +=
                    ` • Column: ${item.referencingAttribute}`;
            }
        }


        componentInspectorReturnSection =
            "relationships";
    }


    else if (
        kind ===
        "process"
    ) {

        name =
            item.name;


        kindText =
            getProcessCategoryName(
                item.category
            );


        type =
            getProcessCategoryName(
                item.category
            );


        status =
            getWorkflowStateName(
                item.stateCode
            );


        membership =
            getMembershipText(
                item.membership
            );


        id =
            item.id ||
            "-";


        details = [

            item.primaryEntity
                ? `Primary Table: ${item.primaryEntity}`
                : null,

            `Component State: ${rg25ComponentState(
                item.componentState
            )}`,

            item.modifiedOn
                ? `Modified: ${rg25FormatDate(
                    item.modifiedOn
                )}`
                : null
        ]
            .filter(Boolean)
            .join(
                " • "
            ) ||
            "-";
    }


    setText(
        "componentInspectorName",
        name
    );


    setText(
        "componentInspectorKind",
        kindText
    );


    setText(
        "componentInspectorType",
        type
    );


    setText(
        "componentInspectorStatus",
        status
    );


    setText(
        "componentInspectorMembership",
        membership
    );


    setText(
        "componentInspectorId",
        id
    );


    setText(
        "componentInspectorDetails",
        details
    );


    let componentType =
        null;


    if (
        kind ===
        "form"
    ) {

        componentType =
            60;
    }


    else if (
        kind ===
        "view"
    ) {

        componentType =
            26;
    }


    else if (
        kind ===
        "relationship"
    ) {

        componentType =
            10;
    }


    else if (
        kind ===
        "process"
    ) {

        componentType =
            29;
    }


    if (
        componentType &&
        id &&
        id !== "-"
    ) {

        rgAnalyzeComponentDependencies(
            id,
            componentType
        );
    }
}


// ============================================================
// BACK NAVIGATION
// ============================================================

function closeComponentInspector() {

    const inspector =
        document.getElementById(
            "componentInspector"
        );


    const tableInspector =
        document.getElementById(
            "tableInspector"
        );


    if (inspector) {

        inspector.style.display =
            "none";
    }


    if (tableInspector) {

        tableInspector.style.display =
            "block";
    }


    showTableComponentSection(
        componentInspectorReturnSection ||
        "forms"
    );
}


// ============================================================
// GENERIC COMPONENT LIST HELPERS
// ============================================================

function createComponentRow(
    clickable = false
) {

    const row =
        document.createElement(
            clickable
                ? "button"
                : "div"
        );


    if (clickable) {

        row.type =
            "button";
    }


    row.className =
        "component-row";


    if (clickable) {

        row.classList.add(
            "component-row-clickable"
        );
    }


    return row;
}


function appendTextElement(
    parent,
    tag,
    text,
    className = ""
) {

    const element =
        document.createElement(
            tag
        );


    element.textContent =
        text ?? "";


    if (
        className
    ) {

        element.className =
            className;
    }


    parent.appendChild(
        element
    );


    return element;
}


// ============================================================
// LABEL HELPERS
// ============================================================

function getFormTypeName(
    type
) {

    const map = {

        0:
            "Dashboard",

        1:
            "Appointment Book",

        2:
            "Main",

        3:
            "Mini Campaign BO",

        4:
            "Preview",

        5:
            "Mobile Express",

        6:
            "Quick View",

        7:
            "Quick Create",

        8:
            "Dialog",

        9:
            "Task Flow",

        10:
            "Interaction Centric Dashboard",

        11:
            "Card",

        12:
            "Main Interactive Experience"
    };


    return (
        map[type] ||
        `Form Type ${type ?? "Unknown"}`
    );
}


function getViewTypeName(
    view
) {

    const parts =
        [];


    if (
        view.isDefault
    ) {

        parts.push(
            "Default"
        );
    }


    if (
        view.isQuickFind
    ) {

        parts.push(
            "Quick Find"
        );
    }


    parts.push(
        view.stateCode ===
            0
            ? "Active"
            : "Inactive"
    );


    return parts.join(
        " • "
    );
}


function getProcessCategoryName(
    category
) {

    const map = {

        0:
            "Workflow",

        1:
            "Dialog",

        2:
            "Business Rule",

        3:
            "Action",

        4:
            "Business Process Flow",

        5:
            "Modern Flow",

        6:
            "Desktop Flow",

        7:
            "AI Flow"
    };


    return (
        map[category] ||
        `Process Category ${category ?? "Unknown"}`
    );
}


function getWorkflowStateName(
    stateCode
) {

    const map = {

        0:
            "Draft",

        1:
            "Activated",

        2:
            "Suspended"
    };


    return (
        map[stateCode] ||
        `State ${stateCode ?? "Unknown"}`
    );
}


function rgComponentTypeName(
    componentType
) {

    return (
        RG_COMPONENT_TYPES[
        componentType
        ] ||
        `Component ${componentType}`
    );
}


function rgDependencyTypeName(
    dependencyType
) {

    return (
        RG_DEPENDENCY_TYPES[
        dependencyType
        ] ||
        `Dependency ${dependencyType}`
    );
}
// ============================================================
// RESET STATE
// ============================================================

function resetComponentCounts() {

    [
        "totalComponents",
        "tableCount",
        "columnCount",
        "formCount",
        "viewCount",
        "workflowCount",
        "webResourceCount",
        "choiceCount",
        "otherCount"
    ]
        .forEach(
            function (id) {

                setText(
                    id,
                    0
                );
            }
        );
}


function resetAnalysisState() {

    analyzedComponents =
        [];


    resolvedTables =
        [];


    selectedTable =
        null;


    selectedColumn =
        null;


    clearTableComponentState();


    resetComponentCounts();


    const analysisCard =
        document.getElementById(
            "analysisCard"
        );


    const tables =
        document.getElementById(
            "tableDetailsSection"
        );


    const tableInspector =
        document.getElementById(
            "tableInspector"
        );


    const columnInspector =
        document.getElementById(
            "columnInspector"
        );


    const componentInspector =
        document.getElementById(
            "componentInspector"
        );


    [
        analysisCard,
        tables,
        tableInspector,
        columnInspector,
        componentInspector
    ]
        .forEach(
            function (element) {

                if (element) {

                    element.style.display =
                        "none";
                }
            }
        );


    rg25ClearExplorerCache();

    rgResetReadinessPanel();

    rgResetDependencyPanel();
}


function resetSolutionState() {

    loadedSolutions =
        [];


    resetAnalysisState();


    const details =
        document.getElementById(
            "solutionDetails"
        );


    const button =
        document.getElementById(
            "analyzeSolutionButton"
        );


    if (details) {

        details.style.display =
            "none";
    }


    if (button) {

        button.style.display =
            "none";
    }
}


function rgResetDependencyPanel() {

    rgMissingDependencies =
        [];


    rgUniqueMissingComponents =
        [];


    rgDependencyFilter =
        "all";


    rgCurrentDependencyBundle = {
        dependents: [],
        required: []
    };


    setText(
        "rgColumnUsedByCount",
        0
    );


    setText(
        "rgColumnDependsOnCount",
        0
    );


    const status =
        document.getElementById(
            "rgColumnDependencyStatus"
        );


    if (status) {

        status.textContent =
            "No dependency analysis loaded.";
    }


    const summary =
        document.getElementById(
            "rgColumnDependencySummary"
        );


    if (summary) {

        summary.style.display =
            "none";
    }


    rgClearElement(
        "rgColumnDependencyList"
    );
}


function rgResetReadinessPanel() {

    rgMissingDependencies =
        [];


    rgUniqueMissingComponents =
        [];


    rgDependencyFilter =
        "all";


    [
        "rgReadinessSolutionName",
        "rgReadinessStatus",
        "rgDependencyStatus",
        "rgReadinessRecommendation"
    ]
        .forEach(
            function (id) {

                const element =
                    document.getElementById(
                        id
                    );


                if (
                    element
                ) {

                    element.textContent =
                        "-";
                }
            }
        );


    [
        "rgReadinessScore",
        "rgTotalDependencyCount",
        "rgUniqueDependencyCount",
        "rgMissingDependencyCount"
    ]
        .forEach(
            function (id) {

                setText(
                    id,
                    0
                );
            }
        );


    rgClearElement(
        "rgDependencyList"
    );


    const panel =
        document.getElementById(
            "rgReadinessPanel"
        );


    if (panel) {

        panel.classList.remove(
            "rg-ready",
            "rg-review",
            "rg-blocked"
        );
    }
}


// ============================================================
// READINESS PANEL
// ============================================================

function rgCreateReadinessPanel() {

    if (
        document.getElementById(
            "rgReadinessPanel"
        )
    ) {

        return;
    }


    const appShell =
        document.querySelector(
            ".app-shell"
        );


    if (!appShell) {

        return;
    }


    const panel =
        document.createElement(
            "section"
        );


    panel.id =
        "rgReadinessPanel";


    panel.className =
        "card rg-readiness-panel";


    panel.style.display =
        "none";


    panel.innerHTML = `

        <div class="rg-readiness-header">

            <div>

                <span class="rg-readiness-eyebrow">
                    DEPLOYMENT ANALYSIS
                </span>

                <h2>
                    Readiness
                </h2>

            </div>


            <div
                id="rgReadinessStatus"
                class="rg-readiness-badge"
            >
                -
            </div>

        </div>


        <div class="rg-readiness-solution">

            <span>
                Solution
            </span>

            <strong id="rgReadinessSolutionName">
                -
            </strong>

        </div>


        <div class="rg-readiness-score-grid rg-readiness-primary-grid">

            <div class="rg-readiness-score-card rg-readiness-score-primary">
                <span>Verification Coverage</span>
                <strong id="rgReadinessScore">0</strong>
                <small>/ 100</small>
            </div>

            <div class="rg-readiness-score-card">
                <span>Needs Review</span>
                <strong id="rgMissingDependencyCount">0</strong>
            </div>

            <div class="rg-readiness-score-card">
                <span>Missing</span>
                <strong id="rgConfirmedMissingCount">0</strong>
            </div>

            <div class="rg-readiness-score-card">
                <span>Config Issues</span>
                <strong id="rgConfigIssueCount">0</strong>
            </div>

            <strong id="rgTotalDependencyCount" style="display:none;">0</strong>
            <strong id="rgUniqueDependencyCount" style="display:none;">0</strong>

        </div>


        <div class="rg-readiness-section">

            <div class="rg-readiness-section-heading">

                <div>

                    <span class="rg-readiness-eyebrow">
                        DEPENDENCIES
                    </span>

                    <h3>
                        Solution Prerequisites
                    </h3>

                </div>

            </div>


            <p
                id="rgDependencyStatus"
                class="rg-readiness-description"
            >
                Analyze a solution to check dependencies.
            </p>


            <div class="rg-dependency-filters">

                <button
                    type="button"
                    class="rg-dependency-filter active"
                    data-rg-dependency-filter="all"
                >
                    All
                </button>


                <button
                    type="button"
                    class="rg-dependency-filter"
                    data-rg-dependency-filter="blocking"
                >
                    Missing
                </button>


                <button
                    type="button"
                    class="rg-dependency-filter"
                    data-rg-dependency-filter="managed"
                >
                    Verified
                </button>


                <button
                    type="button"
                    class="rg-dependency-filter"
                    data-rg-dependency-filter="external"
                >
                    Needs Review
                </button>

            </div>


            <div
                id="rgDependencyList"
                class="rg-readiness-dependency-list"
            ></div>

        </div>


        <div class="rg-readiness-section">

            <span class="rg-readiness-eyebrow">
                RECOMMENDATION
            </span>

            <p id="rgReadinessRecommendation">
                Analyze a solution first.
            </p>

        </div>

    `;


    appShell.appendChild(
        panel
    );


    panel
        .querySelectorAll(
            "[data-rg-dependency-filter]"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        rgDependencyFilter =
                            button.dataset
                                .rgDependencyFilter ||
                            "all";


                        document
                            .querySelectorAll(
                                "[data-rg-dependency-filter]"
                            )
                            .forEach(
                                function (
                                    item
                                ) {

                                    item.classList.remove(
                                        "active"
                                    );
                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        rgRenderReadinessDependencies.visibleCount = 25;
                        rgRenderReadinessDependencies();
                    }
                );
            }
        );
}


// ============================================================
// COLUMN DEPENDENCY PANEL
// ============================================================

function rgCreateColumnDependencyPanel() {

    if (
        document.getElementById(
            "rgColumnDependencyPanel"
        )
    ) {

        return;
    }


    const columnInspector =
        document.getElementById(
            "columnInspector"
        );


    if (!columnInspector) {

        return;
    }


    const panel =
        document.createElement(
            "div"
        );


    panel.id =
        "rgColumnDependencyPanel";


    panel.className =
        "rg-column-dependency-panel";


    panel.innerHTML = `

        <hr />


        <h3>
            Dataverse Dependencies
        </h3>


        <p
            id="rgColumnDependencyStatus"
            class="used-by-status"
        >
            No dependency analysis loaded.
        </p>


        <div
            id="rgColumnDependencySummary"
            class="rg-column-dependency-summary"
            style="display:none;"
        >

            <div>

                <span>
                    Used By
                </span>

                <strong id="rgColumnUsedByCount">
                    0
                </strong>

            </div>


            <div>

                <span>
                    Depends On
                </span>

                <strong id="rgColumnDependsOnCount">
                    0
                </strong>

            </div>

        </div>


        <div
            id="rgColumnDependencyList"
            class="rg-column-dependency-list"
        ></div>

    `;


    columnInspector.appendChild(
        panel
    );
}


// ============================================================
// READINESS ANALYSIS
// ============================================================

function rgAnalyzeSolutionReadiness() {
    const analysisVersion = typeof rgWorkflow !== "undefined" ? rgWorkflow.analysisVersion : 0;


    const select =
        document.getElementById(
            "solutionSelect"
        );


    const solution =
        loadedSolutions.find(
            function (item) {

                return (
                    item.solutionid ===
                    select?.value
                );
            }
        );


    if (
        !solution ||
        !analyzedComponents.length
    ) {

        return;
    }


    const panel =
        document.getElementById(
            "rgReadinessPanel"
        );


    if (panel) {

        panel.style.display =
            "block";
    }


    setText(
        "rgReadinessSolutionName",
        solution.friendlyname ||
        solution.uniquename
    );


    setText(
        "rgDependencyStatus",
        "Analyzing source solution prerequisites..."
    );


    rgMissingDependencies =
        [];


    rgUniqueMissingComponents =
        [];


    sendDynamicsMessage(
        {
            action:
                "getSolutionDependencies",

            solutionId:
                solution.solutionid,

            solutionUniqueName:
                solution.uniquename
        },

        function (response) {
            if (document.getElementById("solutionSelect")?.value !== solution.solutionid ||
                typeof rgWorkflow !== "undefined" && rgWorkflow.analysisVersion !== analysisVersion) return;
            if (typeof rgWorkflow !== "undefined") rgWorkflow.sourceChecked(!!response?.success);

            if (
                !response?.success
            ) {

                setText(
                    "rgDependencyStatus",
                    "Source dependency analysis could not be completed."
                );


                rgUpdateReadinessSummary(
                    {
                        score:
                            75,

                        status:
                            "REVIEW",

                        recommendation:
                            "Source dependency data could not be completely analyzed. Verify the target environment before deployment."
                    }
                );


                return;
            }


            rgMissingDependencies =
                response.dependencies ||
                [];


            rgUniqueMissingComponents =
                rgNormalizeDependencies(
                    rgMissingDependencies
                );


            setText(
                "rgTotalDependencyCount",
                rgMissingDependencies.length
            );


            setText(
                "rgUniqueDependencyCount",
                rgUniqueMissingComponents.length
            );


            /*
             * IMPORTANT:
             *
             * RetrieveMissingDependencies() runs against the
             * SOURCE solution.
             *
             * These rows tell us that prerequisites are not
             * included directly in the source solution.
             *
             * They DO NOT prove those components are absent
             * from UAT.
             *
             * Therefore they must remain "Needs Review"
             * until target verification runs.
             */

            setText(
                "rgMissingDependencyCount",
                rgUniqueMissingComponents.length
            );

            setText("rgConfirmedMissingCount", 0);
            setText("rgConfigIssueCount", 0);


            setText(
                "rgDependencyStatus",

                rgUniqueMissingComponents.length

                    ? `${rgUniqueMissingComponents.length} unique prerequisite component(s) require target verification.`

                    : "No source-side prerequisite records were returned."
            );


            rgRenderReadinessDependencies();


            /*
             * Source-only analysis must never produce BLOCKED.
             *
             * BLOCKED requires verified target evidence.
             */

            let score =
                100;


            if (
                rgUniqueMissingComponents.length
            ) {

                score =
                    Math.max(
                        50,

                        100 -
                        Math.min(
                            rgUniqueMissingComponents.length,
                            50
                        )
                    );
            }


            rgUpdateReadinessSummary(
                {
                    score,

                    status:
                        rgUniqueMissingComponents.length
                            ? "REVIEW"
                            : "READY",

                    recommendation:

                        rgUniqueMissingComponents.length

                            ? "Source prerequisites were detected. Run DEV → Target comparison to verify whether they already exist in the target environment."

                            : "No source-side dependency prerequisites were returned. Target preflight is still recommended before deployment."
                }
            );
        },

        function (message) {
            if (document.getElementById("solutionSelect")?.value !== solution.solutionid ||
                typeof rgWorkflow !== "undefined" && rgWorkflow.analysisVersion !== analysisVersion) return;
            if (typeof rgWorkflow !== "undefined") rgWorkflow.sourceChecked(false);

            setText(
                "rgDependencyStatus",
                message ||
                "Unable to retrieve source dependencies."
            );


            rgUpdateReadinessSummary(
                {
                    score:
                        75,

                    status:
                        "REVIEW",

                    recommendation:
                        "Source dependency verification was unavailable. Run target preflight before deployment."
                }
            );
        }
    );
}
// ============================================================
// APPLY TARGET EVIDENCE TO SOURCE PREREQUISITE LIST
// ============================================================

function rg282ApplyTargetEvidenceToReadinessList(comparison) {
    if (!comparison) return;

    const evidence = new Map();

    function add(records, status) {
        (records || []).forEach(record => {
            const key = `${Number(record.componentType)}:${String(record.objectId || "").toLowerCase()}`;
            evidence.set(key, { ...record, targetStatus: status });
        });
    }

    add(comparison.sameSolution, "satisfied");
    add(comparison.otherSolutions, "satisfied");
    add(comparison.managedBase, "satisfied");
    add(comparison.semanticMatches, "satisfied");
    add(comparison.confirmedMissing, "missing");
    add(comparison.needsVerification, "verification");

    rgUniqueMissingComponents = rgUniqueMissingComponents.map(item => {
        const key = `${Number(item.componentType)}:${String(item.objectId || "").toLowerCase()}`;
        const match = evidence.get(key);
        return match ? { ...item, ...match, raw: item.raw || match.raw || null } : item;
    });
}

// ============================================================
// APPLY TARGET PREFLIGHT TO MAIN READINESS
// ============================================================

function rg282ApplyTargetReadinessToMainPanel(
    comparison
) {

    if (!comparison) {
        return;
    }

    const total = Number(comparison.total || 0);
    const selectedTargetSolution = comparison.sameSolution?.length || 0;
    const otherTargetSolutions = comparison.otherSolutions?.length || 0;
    const managedBase = comparison.managedBase?.length || 0;
    const semanticMatches = comparison.semanticMatches?.length || 0;
    const confirmedMissing = comparison.confirmedMissing?.length || 0;
    const needsVerification = comparison.needsVerification?.length || 0;
    const configurationWarnings = comparison.configWarnings?.length || 0;

    const satisfied =
        selectedTargetSolution +
        otherTargetSolutions +
        managedBase +
        semanticMatches;

    setText("rgTotalDependencyCount", total);
    setText("rgUniqueDependencyCount", total);
    setText("rgMissingDependencyCount", confirmedMissing + needsVerification + configurationWarnings);
    setText("rgConfirmedMissingCount", confirmedMissing);
    setText("rgConfigIssueCount", configurationWarnings);

    setText(
        "rgDependencyStatus",
        `${satisfied} verified • ${confirmedMissing} missing • ` +
        `${needsVerification + configurationWarnings} need review. ` +
        `Verification coverage reflects analyzer confidence; deployment status uses confirmed findings.`
    );

    let status = "READY";

    if (confirmedMissing > 0) {
        status = "BLOCKED";
    }
    else if (needsVerification > 0 || configurationWarnings > 0) {
        status = "REVIEW";
    }

    // Coverage measures how much of the prerequisite set Release Guardian
    // could conclusively evaluate. A confirmed missing component is still a
    // successfully analyzed component, so it must not reduce coverage.
    // Only unresolved identities reduce verification coverage.
    const score =
        total > 0
            ? Math.max(
                0,
                Math.min(
                    100,
                    Math.round(((total - needsVerification) / total) * 100)
                )
            )
            : 100;

    let recommendation;

    if (status === "READY") {
        recommendation =
            "All supported prerequisites were verified in the target environment using exact GUID or stable component identity.";
    }
    else if (status === "BLOCKED") {
        recommendation =
            `${confirmedMissing} prerequisite component(s) were checked by stable identity and were not found in the target environment. Resolve them before deployment.`;
    }
    else {
        recommendation =
            `${needsVerification} prerequisite component(s) could not yet be resolved with enough confidence. No missing component is assumed from this alone; review the unresolved items before deployment.`;
    }

    rgUpdateReadinessSummary({
        score,
        status,
        recommendation
    });

    const shortcut =
        document.getElementById("rgReadinessShortcutStatus");

    if (shortcut) {
        shortcut.textContent =
            status === "READY"
                ? "Target preflight passed"
                : status === "BLOCKED"
                    ? `${confirmedMissing} confirmed missing`
                    : `${needsVerification} component(s) need verification`;
    }
}

// ============================================================
// NORMALIZE DEPENDENCIES
// ============================================================

function rgNormalizeDependencies(
    dependencies
) {

    const unique =
        new Map();


    (
        dependencies ||
        []
    )
        .forEach(
            function (dependency) {

                const objectId =
                    dependency
                        .requiredcomponentobjectid ||
                    dependency
                        .dependentcomponentobjectid ||
                    null;


                const componentType =
                    dependency
                        .requiredcomponenttype ??
                    dependency
                        .dependentcomponenttype;


                if (
                    componentType ===
                    undefined ||
                    componentType ===
                    null
                ) {

                    return;
                }


                const normalizedId =
                    objectId

                        ? String(
                            objectId
                        )
                            .toLowerCase()

                        : "";


                const key =
                    `${componentType}:${normalizedId}`;


                if (
                    unique.has(
                        key
                    )
                ) {

                    return;
                }


                const classification =
                    rgClassifyDependency(
                        dependency,
                        componentType
                    );


                unique.set(
                    key,
                    {
                        objectId,

                        componentType,

                        dependencyType:
                            dependency.dependencytype,

                        classification:
                            classification.classification,

                        severity:
                            classification.severity,

                        reason:
                            classification.reason,

                        raw:
                            dependency
                    }
                );
            }
        );


    return [
        ...unique.values()
    ];
}


// ============================================================
// CLASSIFY DEPENDENCIES
// ============================================================

function rgClassifyDependency(
    dependency,
    componentType
) {

    const dependencyType =
        Number(
            dependency.dependencytype
        );


    if (
        componentType ===
        20
    ) {

        return {

            classification:
                "Security / External",

            severity:
                "external",

            reason:
                "Security roles are commonly deployed separately or already exist in the target environment."
        };
    }


    if (
        [
            16,
            90,
            91,
            201,
            202,
            203,
            204,
            205,
            206,
            207
        ]
            .includes(
                componentType
            )
    ) {

        return {

            classification:
                "Platform / Managed",

            severity:
                "managed",

            reason:
                "This component may be supplied by Microsoft, a managed package, or another prerequisite solution."
        };
    }


    if (
        dependencyType ===
        1
    ) {

        return {

            classification:
                "Internal Dependency",

            severity:
                "blocking",

            reason:
                "The solution contains an explicit internal dependency that should be reviewed before deployment."
        };
    }


    if (
        dependencyType ===
        2
    ) {

        return {

            classification:
                "Published Prerequisite",

            severity:
                "external",

            reason:
                "This published prerequisite may already exist in the target environment or another solution."
        };
    }


    return {

        classification:
            "External / Unresolved",

        severity:
            "external",

        reason:
            "Release Guardian cannot currently prove whether this prerequisite is missing from the target environment."
    };
}


// ============================================================
// READINESS SUMMARY
// ============================================================

function rgUpdateReadinessSummary(
    result
) {

    if (typeof rgWorkflow !== "undefined") rgWorkflow.readinessUpdated();

    setText(
        "rgReadinessScore",
        result.score
    );


    setText(
        "rgReadinessStatus",
        result.status
    );


    setText(
        "rgReadinessRecommendation",
        result.recommendation
    );


    const panel =
        document.getElementById(
            "rgReadinessPanel"
        );


    if (!panel) {

        return;
    }


    panel.classList.remove(
        "rg-ready",
        "rg-review",
        "rg-blocked"
    );


    if (
        result.status ===
        "READY"
    ) {

        panel.classList.add(
            "rg-ready"
        );
    }


    else if (
        result.status ===
        "BLOCKED"
    ) {

        panel.classList.add(
            "rg-blocked"
        );
    }


    else {

        panel.classList.add(
            "rg-review"
        );
    }
}


// ============================================================
// READINESS DEPENDENCY LIST
// ============================================================

function rgRenderReadinessDependencies() {
    const container = document.getElementById("rgDependencyList");
    if (!container) return;
    container.innerHTML = "";
    container.dataset.filter = rgDependencyFilter;
    const comparison = rg28LastComparison;
    const verified = comparison ? [
        ...(comparison.sameSolution || []), ...(comparison.otherSolutions || []),
        ...(comparison.managedBase || []), ...(comparison.semanticMatches || [])
    ] : [];
    let records = comparison ? [
        ...(comparison.confirmedMissing || []).map(item => ({ ...item, targetStatus: "missing" })),
        ...(comparison.needsVerification || []).map(item => ({ ...item, targetStatus: "verification" })),
        ...verified.map(item => ({ ...item, targetStatus: "satisfied" }))
    ] : [...rgUniqueMissingComponents];
    const counts = {
        all: records.length,
        blocking: records.filter(item => item.targetStatus === "missing").length,
        managed: records.filter(item => item.targetStatus === "satisfied").length,
        external: records.filter(item => !item.targetStatus || item.targetStatus === "verification").length
    };
    const labels = { all: "All", blocking: "Confirmed missing", managed: "Verified", external: "Not verified" };
    document.querySelectorAll("[data-rg-dependency-filter]").forEach(button => {
        const filter = button.dataset.rgDependencyFilter;
        button.textContent = `${labels[filter]} (${counts[filter]})`;
        button.classList.toggle("active", filter === rgDependencyFilter);
        button.setAttribute("aria-pressed", String(filter === rgDependencyFilter));
    });
    if (rgDependencyFilter === "blocking") records = records.filter(item => item.targetStatus === "missing");
    else if (rgDependencyFilter === "managed") records = records.filter(item => item.targetStatus === "satisfied");
    else if (rgDependencyFilter === "external") records = records.filter(item => !item.targetStatus || item.targetStatus === "verification");

    if (!records.length) {
        container.innerHTML = `<div class="rg-readiness-empty">${comparison ? "No prerequisites in this category." : "No source prerequisite records in this category. The target has not been checked."}</div>`;
        return;
    }
    const limit = rgRenderReadinessDependencies.visibleCount || 25;
    records.slice(0, limit).forEach(dependency => {
        const status = dependency.targetStatus === "satisfied" ? "satisfied"
            : dependency.targetStatus === "missing" ? "missing" : "verification";
        const wrapper = document.createElement("div");
        wrapper.innerHTML = rg282HumanDependencyCard(dependency, status);
        if (wrapper.firstElementChild) container.appendChild(wrapper.firstElementChild);
    });
    if (records.length > limit) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "secondary-button rg-flow-more-findings";
        more.textContent = `Show more (${records.length - limit} remaining)`;
        more.addEventListener("click", () => {
            rgRenderReadinessDependencies.visibleCount = limit + 25;
            rgRenderReadinessDependencies();
        });
        container.appendChild(more);
    }
}


// ============================================================
// APP NAVIGATION
// ============================================================

function rgInitializeAppNavigation() {

    if (
        document.getElementById(
            "rgAppNavigation"
        )
    ) {

        return;
    }


    rgCreateAppNavigation();

    rgCreateScreens();

    rgMoveExistingSectionsIntoScreens();

    if (typeof rgWorkflow !== "undefined") rgWorkflow.initialize();
    rgShowScreen("home");
}


function rgCreateAppNavigation() {

    const appShell =
        document.querySelector(
            ".app-shell"
        );


    if (!appShell) {

        return;
    }


    const navigation =
        document.createElement(
            "div"
        );


    navigation.id =
        "rgAppNavigation";


    navigation.className =
        "rg-app-navigation";


    navigation.innerHTML = `

        <button
            class="rg-nav-button active"
            data-rg-screen="home"
        >
            Home
        </button>

        <button
            class="rg-nav-button"
            data-rg-screen="solution"
        >
            Solution
        </button>

        <button
            class="rg-nav-button"
            data-rg-screen="explorer"
        >
            Explorer
        </button>

        <button
            class="rg-nav-button"
            data-rg-screen="readiness"
        >
            Readiness
        </button>
    `;


    const title =
        appShell.querySelector(
            ":scope > h1"
        );


    if (title) {

        title.insertAdjacentElement(
            "afterend",
            navigation
        );
    }

    else {

        appShell.prepend(
            navigation
        );
    }


    navigation
        .querySelectorAll(
            "[data-rg-screen]"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        rgShowScreen(
                            button.dataset.rgScreen
                        );
                    }
                );
            }
        );
}


function rgCreateScreens() {

    const appShell =
        document.querySelector(
            ".app-shell"
        );


    if (
        !appShell ||
        document.getElementById(
            "rgScreenContainer"
        )
    ) {

        return;
    }


    const container =
        document.createElement(
            "div"
        );


    container.id =
        "rgScreenContainer";


    container.innerHTML = `

        <div
            id="rgScreenHome"
            class="rg-screen"
            data-screen="home"
        ></div>

        <div
            id="rgScreenSolution"
            class="rg-screen"
            data-screen="solution"
            style="display:none;"
        ></div>

        <div
            id="rgScreenExplorer"
            class="rg-screen"
            data-screen="explorer"
            style="display:none;"
        ></div>

        <div
            id="rgScreenReadiness"
            class="rg-screen"
            data-screen="readiness"
            style="display:none;"
        ></div>
    `;


    appShell.appendChild(
        container
    );
}


function rgMoveExistingSectionsIntoScreens() {

    const home =
        document.getElementById(
            "rgScreenHome"
        );


    const solution =
        document.getElementById(
            "rgScreenSolution"
        );


    const explorer =
        document.getElementById(
            "rgScreenExplorer"
        );


    const readiness =
        document.getElementById(
            "rgScreenReadiness"
        );


    const appShell =
        document.querySelector(
            ".app-shell"
        );


    if (
        !home ||
        !solution ||
        !explorer ||
        !readiness ||
        !appShell
    ) {

        return;
    }


    [
        ...appShell.children
    ]
        .forEach(
            function (element) {

                if (
                    [
                        "rgScreenContainer",
                        "rgAppNavigation"
                    ]
                        .includes(
                            element.id
                        ) ||

                    element.tagName ===
                    "H1"
                ) {

                    return;
                }


                if (
                    element.id ===
                    "analysisCard"
                ) {

                    solution.appendChild(
                        element
                    );

                    return;
                }


                if (
                    [
                        "tableDetailsSection",
                        "tableInspector",
                        "columnInspector",
                        "componentInspector"
                    ]
                        .includes(
                            element.id
                        )
                ) {

                    explorer.appendChild(
                        element
                    );

                    return;
                }


                home.appendChild(
                    element
                );
            }
        );


    const readinessPanel =
        document.getElementById(
            "rgReadinessPanel"
        );


    if (
        readinessPanel
    ) {

        readiness.appendChild(
            readinessPanel
        );


        readinessPanel.style.display =
            "none";
    }


    rgEnsureScreenHeader(
        "rgScreenHome",
        "Home",
        "Connect to Dataverse and select a solution."
    );


    rgEnsureScreenHeader(
        "rgScreenSolution",
        "Solution Overview",
        "Explore the components included in the selected solution."
    );


    rgEnsureScreenHeader(
        "rgScreenExplorer",
        "Component Explorer",
        "Inspect solution components and dependencies."
    );


    rgEnsureScreenHeader(
        "rgScreenReadiness",
        "Deployment Readiness",
        "Review prerequisites and deployment risks before export."
    );


    rgEnhanceReadinessNavigation();
}


function rgEnsureScreenHeader(
    screenId,
    title,
    description
) {

    const screen =
        document.getElementById(
            screenId
        );


    if (
        !screen ||
        screen.querySelector(
            ".rg-screen-header"
        )
    ) {

        return;
    }


    const header =
        document.createElement(
            "div"
        );


    header.className =
        "rg-screen-header";


    header.innerHTML = `

        <div>

            <h2>
                ${rgEscapeHtml(title)}
            </h2>

            <p>
                ${rgEscapeHtml(description)}
            </p>

        </div>
    `;


    screen.prepend(
        header
    );
}


function rgShowScreen(
    screenName
) {

    if (typeof rgWorkflow !== "undefined" && !rgWorkflow.canOpen(screenName)) screenName = "home";
    rgCurrentScreen =
        screenName;


    document
        .querySelectorAll(
            ".rg-screen"
        )
        .forEach(
            function (screen) {

                screen.style.display =
                    screen.dataset.screen ===
                        screenName

                        ? "block"

                        : "none";
            }
        );


    document
        .querySelectorAll(
            ".rg-nav-button"
        )
        .forEach(
            function (button) {

                button.classList.toggle(
                    "active",
                    button.dataset.rgScreen ===
                    screenName
                );
            }
        );


    if (typeof rgWorkflow !== "undefined") rgWorkflow.screenChanged(screenName);
    window.scrollTo({
        top: 0,
        behavior: "instant"
    });
}


function rgEnhanceReadinessNavigation() {

    const solution =
        document.getElementById(
            "rgScreenSolution"
        );


    if (
        !solution ||
        document.getElementById(
            "rgReadinessShortcut"
        )
    ) {

        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.id =
        "rgReadinessShortcut";


    button.className =
        "rg-readiness-shortcut";


    button.innerHTML = `

        <div>

            <span>
                Deployment Readiness
            </span>

            <strong id="rgReadinessShortcutStatus">
                Run preflight analysis
            </strong>

        </div>

        <span class="rg-shortcut-arrow">
            →
        </span>
    `;


    button.addEventListener(
        "click",
        function () {

            rgShowScreen(
                "readiness"
            );
        }
    );


    document
        .getElementById(
            "analysisCard"
        )
        ?.appendChild(
            button
        );
}


function rgUpdateReadinessShortcut() {

    const badge =
        document.getElementById(
            "rgReadinessBadge"
        );


    const target =
        document.getElementById(
            "rgReadinessShortcutStatus"
        );


    if (
        target &&
        badge
    ) {

        target.textContent =
            `${badge.textContent} · View preflight`;
    }
}
// ============================================================
// EXPLORER DATA
// ============================================================

function rg25GetComponentIds(
    componentType
) {

    return analyzedComponents
        .filter(
            function (component) {

                return (
                    Number(component.inventoryComponentType ?? component.componenttype) ===
                    componentType
                );
            }
        )
        .map(
            function (component) {

                return component.objectid;
            }
        )
        .filter(Boolean);
}


function rg25ClearExplorerCache() {

    rg25ExplorerData =
        null;


    rg25ExplorerSolutionId =
        null;


    rg25ExplorerLoadingPromise =
        null;
}


function rg25LoadExplorerData() {

    const solutionId =
        document.getElementById(
            "solutionSelect"
        )?.value;


    if (!solutionId) {

        return Promise.reject(
            new Error(
                "Select a solution first."
            )
        );
    }


    if (
        rg25ExplorerData &&
        rg25ExplorerSolutionId ===
        solutionId
    ) {

        return Promise.resolve(
            rg25ExplorerData
        );
    }


    if (
        rg25ExplorerLoadingPromise &&
        rg25ExplorerSolutionId ===
        solutionId
    ) {

        return rg25ExplorerLoadingPromise;
    }


    rg25ExplorerSolutionId =
        solutionId;


    const payload = {

        action:
            "getSolutionExplorerData",

        solutionId,

        workflowComponentIds:
            rg25GetComponentIds(
                29
            ),

        webResourceComponentIds:
            rg25GetComponentIds(
                61
            ),

        formComponentIds:
            rg25GetComponentIds(
                60
            ),

        viewComponentIds:
            rg25GetComponentIds(
                26
            ),

        choiceComponentIds:
            rg25GetComponentIds(
                9
            ),

        environmentVariableComponentIds:
            rg25GetComponentIds(
                380
            ),

        connectionReferenceComponentIds:
            rg25GetComponentIds(
                371
            ),

        pluginAssemblyComponentIds:
            rg25GetComponentIds(
                91
            ),

        pluginTypeComponentIds:
            rg25GetComponentIds(
                90
            ),

        pluginStepComponentIds:
            rg25GetComponentIds(
                92
            )
    };


    rg25ExplorerLoadingPromise =
        new Promise(
            function (
                resolve,
                reject
            ) {

                sendDynamicsMessage(
                    payload,
                    function (response) {

                        rg25ExplorerLoadingPromise =
                            null;


                        if (
                            !response?.success
                        ) {

                            reject(
                                new Error(
                                    response?.error ||
                                    "Explorer data could not be loaded."
                                )
                            );

                            return;
                        }


                        rg25ExplorerData =
                            response;


                        if (
                            response.errors
                                ?.length
                        ) {

                            console.warn(
                                "Release Guardian explorer partial errors:",
                                response.errors
                            );
                        }


                        resolve(
                            response
                        );
                    },
                    function (message) {

                        rg25ExplorerLoadingPromise =
                            null;


                        reject(
                            new Error(
                                message ||
                                "Explorer data could not be loaded."
                            )
                        );
                    }
                );
            }
        );


    return rg25ExplorerLoadingPromise;
}


// ============================================================
// EXPLORER SHELL
// ============================================================

function rg25GetExplorer() {

    return document.getElementById(
        "rgScreenExplorer"
    );
}


function rg25ResetExplorer() {

    const explorer =
        rg25GetExplorer();


    if (!explorer) {

        return null;
    }


    [
        ...explorer.children
    ]
        .forEach(
            function (child) {

                if (
                    child.classList.contains(
                        "rg-screen-header"
                    )
                ) {

                    return;
                }


                if (
                    [
                        "tableDetailsSection",
                        "tableInspector",
                        "columnInspector",
                        "componentInspector"
                    ]
                        .includes(
                            child.id
                        )
                ) {

                    child.style.display =
                        "none";

                    return;
                }


                child.remove();
            }
        );


    return explorer;
}


function rg25ResetExplorerPreserveTables() {

    const explorer =
        rg25GetExplorer();


    if (!explorer) {

        return null;
    }


    [
        ...explorer.children
    ]
        .forEach(
            function (child) {

                if (
                    child.classList.contains(
                        "rg-screen-header"
                    )
                ) {

                    return;
                }


                if (
                    [
                        "tableDetailsSection",
                        "tableInspector",
                        "columnInspector",
                        "componentInspector"
                    ]
                        .includes(
                            child.id
                        )
                ) {

                    child.style.display =
                        child.id ===
                            "tableDetailsSection"

                            ? "block"

                            : "none";

                    return;
                }


                child.remove();
            }
        );


    return explorer;
}


function rg25CreateExplorerPage(
    title,
    subtitle
) {

    rgShowScreen(
        "explorer"
    );


    const explorer =
        rg25ResetExplorer();


    if (!explorer) {

        return null;
    }


    const page =
        document.createElement(
            "section"
        );


    page.className =
        "card rg25-explorer-page";


    page.innerHTML = `

        <div class="rg25-explorer-header">

            <div>

                <h2>
                    ${rgEscapeHtml(title)}
                </h2>

                <p>
                    ${rgEscapeHtml(subtitle)}
                </p>

            </div>

        </div>

        <input
            class="search-input rg25-search"
            type="search"
            placeholder="Search..."
        />

        <div
            class="rg25-explorer-list"
        ></div>
    `;


    explorer.appendChild(
        page
    );


    return page;
}


function rg25ShowLoading(
    title
) {

    const page =
        rg25CreateExplorerPage(
            title,
            "Loading solution metadata..."
        );


    if (!page) {

        return;
    }


    page
        .querySelector(
            ".rg25-search"
        )
        .style.display =
        "none";


    page
        .querySelector(
            ".rg25-explorer-list"
        )
        .innerHTML =
        '<div class="rg-loading">Loading…</div>';
}


function rg25ShowError(
    title,
    error
) {

    const page =
        rg25CreateExplorerPage(
            title,
            "Unable to load this explorer."
        );


    if (!page) {

        return;
    }


    page
        .querySelector(
            ".rg25-search"
        )
        .style.display =
        "none";


    page
        .querySelector(
            ".rg25-explorer-list"
        )
        .innerHTML = `

            <div class="rg-warning">

                ${rgEscapeHtml(
            error?.message ||
            String(error)
        )}

            </div>
        `;
}


// ============================================================
// GENERIC EXPLORER LIST
// ============================================================

async function rg25ShowListExplorer(
    options
) {

    rg25ShowLoading(
        options.title
    );


    try {

        const data =
            await rg25LoadExplorerData();


        const records =
            options.getRecords(
                data
            ) ||
            [];


        const page =
            rg25CreateExplorerPage(
                options.title,
                `${records.length} component(s) resolved from the selected solution.`
            );


        if (!page) {

            return;
        }


        const search =
            page.querySelector(
                ".rg25-search"
            );


        const list =
            page.querySelector(
                ".rg25-explorer-list"
            );


        function render() {

            const query =
                search.value
                    .toLowerCase()
                    .trim();


            const filtered =
                records.filter(
                    function (record) {

                        return (
                            !query ||

                            options
                                .searchText(
                                    record
                                )
                                .toLowerCase()
                                .includes(
                                    query
                                )
                        );
                    }
                );


            list.innerHTML =
                "";


            if (
                !filtered.length
            ) {

                list.innerHTML =
                    '<div class="rg-empty">No matching components.</div>';

                return;
            }


            filtered.forEach(
                function (record) {

                    const display =
                        options.display(
                            record,
                            data
                        );


                    const row =
                        document.createElement(
                            "button"
                        );


                    row.type =
                        "button";


                    row.className =
                        "rg25-record";


                    row.innerHTML = `

                        <div class="rg25-record-main">

                            <strong>
                                ${rgEscapeHtml(
                        display.title
                    )}
                            </strong>

                            ${display.subtitle

                            ? `
                                    <span>
                                        ${rgEscapeHtml(
                                display.subtitle
                            )}
                                    </span>
                                `

                            : ""
                        }

                        </div>

                        <div class="rg25-record-meta">

                            ${rgEscapeHtml(
                            display.meta ||
                            ""
                        )}

                        </div>
                    `;


                    row.addEventListener(
                        "click",
                        function () {

                            rg25ShowRecordDetails(
                                options.title,
                                display
                            );
                        }
                    );


                    list.appendChild(
                        row
                    );
                }
            );
        }


        search.addEventListener(
            "input",
            render
        );


        render();
    }
    catch (error) {

        rg25ShowError(
            options.title,
            error
        );
    }
}
// ============================================================
// EXPLORER DETAILS
// ============================================================

function rg25ShowRecordDetails(
    explorerTitle,
    display
) {

    const explorer =
        rg25ResetExplorer();


    if (!explorer) {

        return;
    }


    const rows =
        (
            display.details ||
            []
        )
            .filter(
                function (row) {

                    return (
                        row.value !==
                        undefined &&

                        row.value !==
                        null &&

                        row.value !==
                        "" &&

                        !rg25IsZeroGuid(
                            row.value
                        )
                    );
                }
            );


    const card =
        document.createElement(
            "section"
        );


    card.className =
        "card rg25-detail-page";


    card.innerHTML = `

        <button
            class="secondary-button full-width rg25-detail-back"
            type="button"
        >
            ← Back to
            ${rgEscapeHtml(explorerTitle)}
        </button>

        <h2>
            ${rgEscapeHtml(
        display.title
    )}
        </h2>

        ${display.subtitle

            ? `
                <p class="logical-name">

                    ${rgEscapeHtml(
                display.subtitle
            )}

                </p>
            `

            : ""
        }

        <div class="detail-stack">

            ${rows
            .map(
                function (row) {

                    return `

                            <div>

                                <label>
                                    ${rgEscapeHtml(
                        row.label
                    )}
                                </label>

                                <div>
                                    ${rgEscapeHtml(
                        String(
                            row.value
                        )
                    )}
                                </div>

                            </div>
                        `;
                }
            )
            .join(
                ""
            )
        }

        </div>
    `;


    explorer.appendChild(
        card
    );


    card
        .querySelector(
            ".rg25-detail-back"
        )
        .addEventListener(
            "click",
            function () {

                rg25OpenExplorerByName(
                    explorerTitle
                );
            }
        );
}


// ============================================================
// PROCESSES EXPLORER
// ============================================================

function rg25ShowProcesses() {

    rg25ShowListExplorer({

        title:
            "Workflows / Processes",

        getRecords:
            function (data) {

                return (
                    data.workflows ||
                    []
                );
            },

        searchText:
            function (record) {

                return [

                    record.name,
                    record.uniquename,
                    record.primaryentity,

                    getProcessCategoryName(
                        record.category
                    ),

                    getWorkflowStateName(
                        record.statecode
                    ),

                    record.workflowid,
                    record.workflowidunique

                ]
                    .join(
                        " "
                    );
            },

        display:
            function (record) {

                return {

                    title:
                        record.name ||
                        "Unnamed Process",

                    subtitle:
                        record.uniquename ||
                        record.primaryentity ||
                        "",

                    meta:
                        `${getProcessCategoryName(
                            record.category
                        )} • ${getWorkflowStateName(
                            record.statecode
                        )}`,

                    details: [

                        {
                            label:
                                "Category",

                            value:
                                getProcessCategoryName(
                                    record.category
                                )
                        },

                        {
                            label:
                                "Status",

                            value:
                                getWorkflowStateName(
                                    record.statecode
                                )
                        },

                        {
                            label:
                                "Primary Table",

                            value:
                                record.primaryentity ||
                                "None"
                        },

                        {
                            label:
                                "Definition Type",

                            value:
                                rg25WorkflowType(
                                    record.type
                                )
                        },

                        {
                            label:
                                "Mode",

                            value:
                                record.mode ===
                                    1

                                    ? "Real-time"

                                    : "Background"
                        },

                        {
                            label:
                                "On Demand",

                            value:
                                record.ondemand

                                    ? "Yes"

                                    : "No"
                        },

                        {
                            label:
                                "Managed",

                            value:
                                record.ismanaged

                                    ? "Yes"

                                    : "No"
                        },

                        {
                            label:
                                "Component State",

                            value:
                                rg25ComponentState(
                                    record.componentstate
                                )
                        },

                        {
                            label:
                                "Workflow ID",

                            value:
                                record.workflowid
                        },

                        {
                            label:
                                "Workflow Unique ID",

                            value:
                                record.workflowidunique
                        },

                        {
                            label:
                                "Modified",

                            value:
                                rg25FormatDate(
                                    record.modifiedon
                                )
                        }
                    ]
                };
            }
    });
}


// ============================================================
// WEB RESOURCES EXPLORER
// ============================================================

function rg25ShowWebResources() {

    rg25ShowListExplorer({

        title:
            "Web Resources",

        getRecords:
            function (data) {

                return (
                    data.webResources ||
                    []
                );
            },

        searchText:
            function (record) {

                return [

                    record.name,
                    record.displayname,

                    rg25WebResourceType(
                        record.webresourcetype
                    )

                ]
                    .join(
                        " "
                    );
            },

        display:
            function (record) {

                return {

                    title:
                        record.displayname ||
                        record.name ||
                        "Web Resource",

                    subtitle:
                        record.name ||
                        "",

                    meta:
                        `${rg25WebResourceType(
                            record.webresourcetype
                        )} • ${record.ismanaged
                            ? "Managed"
                            : "Unmanaged"
                        }`,

                    details: [

                        {
                            label:
                                "Name",

                            value:
                                record.name
                        },

                        {
                            label:
                                "Type",

                            value:
                                rg25WebResourceType(
                                    record.webresourcetype
                                )
                        },

                        {
                            label:
                                "Managed",

                            value:
                                record.ismanaged

                                    ? "Yes"

                                    : "No"
                        },

                        {
                            label:
                                "Component State",

                            value:
                                rg25ComponentState(
                                    record.componentstate
                                )
                        },

                        {
                            label:
                                "Description",

                            value:
                                record.description
                        },

                        {
                            label:
                                "Web Resource ID",

                            value:
                                record.webresourceid
                        },

                        {
                            label:
                                "Modified",

                            value:
                                rg25FormatDate(
                                    record.modifiedon
                                )
                        }
                    ]
                };
            }
    });
}


// ============================================================
// FORMS EXPLORER
// ============================================================

function rg25ShowForms() {

    rg25ShowListExplorer({

        title:
            "Forms",

        getRecords:
            function (data) {

                return (
                    data.forms ||
                    []
                );
            },

        searchText:
            function (record) {

                return [

                    record.name,
                    record.uniquename,
                    record.objecttypecode,

                    getFormTypeName(
                        record.type
                    )

                ]
                    .join(
                        " "
                    );
            },

        display:
            function (record) {

                return {

                    title:
                        record.name ||
                        "Unnamed Form",

                    subtitle:
                        record.objecttypecode ||
                        record.uniquename ||
                        "",

                    meta:
                        `${getFormTypeName(
                            record.type
                        )} • ${record.ismanaged
                            ? "Managed"
                            : "Unmanaged"
                        }`,

                    details: [

                        {
                            label:
                                "Form Type",

                            value:
                                getFormTypeName(
                                    record.type
                                )
                        },

                        {
                            label:
                                "Table",

                            value:
                                record.objecttypecode
                        },

                        {
                            label:
                                "Unique Name",

                            value:
                                record.uniquename
                        },

                        {
                            label:
                                "Managed",

                            value:
                                record.ismanaged

                                    ? "Yes"

                                    : "No"
                        },

                        {
                            label:
                                "Form ID",

                            value:
                                record.formid
                        }
                    ]
                };
            }
    });
}


// ============================================================
// VIEWS EXPLORER
// ============================================================

function rg25ShowViews() {

    rg25ShowListExplorer({

        title:
            "Views",

        getRecords:
            function (data) {

                return (
                    data.views ||
                    []
                );
            },

        searchText:
            function (record) {

                return [

                    record.name,
                    record.returnedtypecode

                ]
                    .join(
                        " "
                    );
            },

        display:
            function (record) {

                const flags =
                    [];


                if (
                    record.isdefault
                ) {

                    flags.push(
                        "Default"
                    );
                }


                if (
                    record.isquickfindquery
                ) {

                    flags.push(
                        "Quick Find"
                    );
                }


                flags.push(
                    record.statecode ===
                        0

                        ? "Active"

                        : "Inactive"
                );


                return {

                    title:
                        record.name ||
                        "Unnamed View",

                    subtitle:
                        record.returnedtypecode ||
                        "",

                    meta:
                        flags.join(
                            " • "
                        ),

                    details: [

                        {
                            label:
                                "Table",

                            value:
                                record.returnedtypecode
                        },

                        {
                            label:
                                "Status",

                            value:
                                record.statecode ===
                                    0

                                    ? "Active"

                                    : "Inactive"
                        },

                        {
                            label:
                                "Default View",

                            value:
                                record.isdefault

                                    ? "Yes"

                                    : "No"
                        },

                        {
                            label:
                                "Quick Find",

                            value:
                                record.isquickfindquery

                                    ? "Yes"

                                    : "No"
                        },

                        {
                            label:
                                "View ID",

                            value:
                                record.savedqueryid
                        }
                    ]
                };
            }
    });
}
// ============================================================
// ENVIRONMENT VARIABLES EXPLORER
// ============================================================

function rg25ShowEnvironmentVariables() {

    rg25ShowListExplorer({

        title:
            "Environment Variables",

        getRecords:
            data =>
                data.environmentVariables ||
                [],

        searchText:
            record => [

                record.displayname,
                record.schemaname,

                rg25EnvironmentVariableType(
                    record.type
                )

            ].join(" "),

        display:
            function (record) {

                const values =
                    record.currentValues ||
                    [];


                const activeValue =
                    values.find(
                        value =>
                            value.statecode ===
                            0
                    );


                const hasCurrentValue =
                    Boolean(
                        activeValue &&
                        activeValue.value !==
                        null &&
                        activeValue.value !==
                        undefined &&
                        String(
                            activeValue.value
                        ).trim() !==
                        ""
                    );


                const isSecret =
                    record.type ===
                    100000005;


                return {

                    title:
                        record.displayname ||
                        record.schemaname ||
                        "Environment Variable",

                    subtitle:
                        record.schemaname ||
                        "",

                    meta:
                        `${rg25EnvironmentVariableType(
                            record.type
                        )} • ${hasCurrentValue
                            ? "Configured"
                            : "Missing current value"
                        }`,

                    details: [

                        {
                            label:
                                "Schema Name",

                            value:
                                record.schemaname
                        },

                        {
                            label:
                                "Type",

                            value:
                                rg25EnvironmentVariableType(
                                    record.type
                                )
                        },

                        {
                            label:
                                "Required",

                            value:
                                record.isrequired
                                    ? "Yes"
                                    : "No"
                        },

                        {
                            label:
                                "Current Value",

                            // Never expose secret values.
                            value:
                                isSecret
                                    ? (
                                        hasCurrentValue
                                            ? "Configured"
                                            : "Not configured"
                                    )
                                    : (
                                        activeValue?.value ||
                                        "Not configured"
                                    )
                        },

                        {
                            label:
                                "Default Value",

                            value:
                                isSecret
                                    ? "Hidden"
                                    : (
                                        record.defaultvalue ||
                                        "None"
                                    )
                        },

                        {
                            label:
                                "Managed",

                            value:
                                record.ismanaged
                                    ? "Yes"
                                    : "No"
                        },

                        {
                            label:
                                "Definition ID",

                            value:
                                record.environmentvariabledefinitionid
                        }
                    ]
                };
            }
    });
}


// ============================================================
// CONNECTION REFERENCES
// ============================================================

function rg25ShowConnectionReferences() {

    rg25ShowListExplorer({

        title:
            "Connection References",

        getRecords:
            data =>
                data.connectionReferences ||
                [],

        searchText:
            record => [

                record.connectionreferencedisplayname,
                record.connectionreferencelogicalname,
                record.connectorid

            ].join(" "),

        display:
            function (record) {

                return {

                    title:
                        record.connectionreferencedisplayname ||
                        record.connectionreferencelogicalname ||
                        "Connection Reference",

                    subtitle:
                        record.connectionreferencelogicalname ||
                        "",

                    meta:
                        `${record.statecode ===
                            0
                            ? "Active"
                            : "Inactive"
                        } • ${record.ismanaged
                            ? "Managed"
                            : "Unmanaged"
                        }`,

                    details: [

                        {
                            label:
                                "Logical Name",

                            value:
                                record.connectionreferencelogicalname
                        },

                        {
                            label:
                                "Connector ID",

                            value:
                                record.connectorid
                        },

                        {
                            label:
                                "Status",

                            value:
                                record.statecode ===
                                    0
                                    ? "Active"
                                    : "Inactive"
                        },

                        {
                            label:
                                "Import Behavior",

                            value:
                                record.promptingbehavior ===
                                    1
                                    ? "Skip prompt"
                                    : "Prompt on import"
                        },

                        {
                            label:
                                "Managed",

                            value:
                                record.ismanaged
                                    ? "Yes"
                                    : "No"
                        },

                        {
                            label:
                                "Connection Reference ID",

                            value:
                                record.connectionreferenceid
                        }
                    ]
                };
            }
    });
}


// ============================================================
// PLUG-IN ASSEMBLIES
// ============================================================

function rg25ShowPluginAssemblies() {

    rg25ShowListExplorer({

        title:
            "Plug-in Assemblies",

        getRecords:
            data =>
                data.pluginAssemblies ||
                [],

        searchText:
            record => [

                record.name,
                record.version,
                record.publickeytoken

            ].join(" "),

        display:
            function (record) {

                return {

                    title:
                        record.name ||
                        "Plug-in Assembly",

                    subtitle:
                        record.version ||
                        "",

                    meta:
                        `${rg25IsolationMode(
                            record.isolationmode
                        )} • ${record.ismanaged
                            ? "Managed"
                            : "Unmanaged"
                        }`,

                    details: [

                        {
                            label:
                                "Version",

                            value:
                                record.version
                        },

                        {
                            label:
                                "Isolation",

                            value:
                                rg25IsolationMode(
                                    record.isolationmode
                                )
                        },

                        {
                            label:
                                "Source",

                            value:
                                rg25PluginSource(
                                    record.sourcetype
                                )
                        },

                        {
                            label:
                                "Managed",

                            value:
                                record.ismanaged
                                    ? "Yes"
                                    : "No"
                        },

                        {
                            label:
                                "Public Key Token",

                            value:
                                record.publickeytoken
                        },

                        {
                            label:
                                "Assembly ID",

                            value:
                                record.pluginassemblyid
                        },

                        {
                            label:
                                "Modified",

                            value:
                                rg25FormatDate(
                                    record.modifiedon
                                )
                        }
                    ]
                };
            }
    });
}


// ============================================================
// PLUG-IN STEPS
// ============================================================

function rg25ShowPluginSteps() {

    rg25ShowListExplorer({

        title:
            "Plug-in Steps",

        getRecords:
            data =>
                data.pluginSteps ||
                [],

        searchText:
            record => [

                record.name,

                rg25PluginStage(
                    record.stage
                ),

                rg25PluginMode(
                    record.mode
                )

            ].join(" "),

        display:
            function (record) {

                return {

                    title:
                        record.name ||
                        "Plug-in Step",

                    subtitle:
                        rg25PluginStage(
                            record.stage
                        ),

                    meta:
                        `${rg25PluginMode(
                            record.mode
                        )} • ${record.statecode ===
                            0
                            ? "Enabled"
                            : "Disabled"
                        }`,

                    details: [

                        {
                            label:
                                "Stage",

                            value:
                                rg25PluginStage(
                                    record.stage
                                )
                        },

                        {
                            label:
                                "Mode",

                            value:
                                rg25PluginMode(
                                    record.mode
                                )
                        },

                        {
                            label:
                                "Execution Order",

                            value:
                                record.rank
                        },

                        {
                            label:
                                "Status",

                            value:
                                record.statecode ===
                                    0
                                    ? "Enabled"
                                    : "Disabled"
                        },

                        {
                            label:
                                "Deployment",

                            value:
                                rg25PluginDeployment(
                                    record.supporteddeployment
                                )
                        },

                        {
                            label:
                                "Step ID",

                            value:
                                record.sdkmessageprocessingstepid
                        },

                        {
                            label:
                                "Event Handler ID",

                            value:
                                record._eventhandler_value
                        }
                    ]
                };
            }
    });
}


// ============================================================
// CHOICES
// ============================================================

function rg25ShowChoices() {

    rg25ShowListExplorer({

        title:
            "Choices",

        getRecords:
            data =>
                data.choices ||
                [],

        searchText:
            record => [

                record.Name,

                getLocalizedLabel(
                    record.DisplayName
                )

            ].join(" "),

        display:
            function (record) {

                return {

                    title:
                        getLocalizedLabel(
                            record.DisplayName
                        ) ||
                        record.Name ||
                        "Choice",

                    subtitle:
                        record.Name ||
                        "",

                    meta:
                        record.IsCustomOptionSet
                            ? "Custom Choice"
                            : "Standard Choice",

                    details: [

                        {
                            label:
                                "Name",

                            value:
                                record.Name
                        },

                        {
                            label:
                                "Custom",

                            value:
                                record.IsCustomOptionSet
                                    ? "Yes"
                                    : "No"
                        },

                        {
                            label:
                                "Metadata ID",

                            value:
                                record.MetadataId
                        }
                    ]
                };
            }
    });
}


// ============================================================
// EXPLORER ROUTING
// ============================================================

function rg25OpenExplorerByName(
    name
) {

    const routes = {

        "Workflows / Processes":
            rg26ShowProcesses,

        "Web Resources":
            rg25ShowWebResources,

        "Forms":
            rg25ShowForms,

        "Views":
            rg25ShowViews,

        "Environment Variables":
            rg25ShowEnvironmentVariables,

        "Connection References":
            rg25ShowConnectionReferences,

        "Plug-in Assemblies":
            rg25ShowPluginAssemblies,

        "Plug-in Steps":
            rg25ShowPluginSteps,

        "Choices":
            rg25ShowChoices
    };


    routes[
        name
    ]?.();
}


// ============================================================
// SOLUTION SUMMARY BINDING
// ============================================================

function rg25ReplaceClickHandler(
    element,
    handler,
    title
) {

    if (!element) {

        return;
    }


    const clone =
        element.cloneNode(
            true
        );


    element.replaceWith(
        clone
    );


    clone.classList.add(
        "rg-navigable-summary"
    );


    clone.style.cursor =
        "pointer";


    if (title) {

        clone.title =
            title;
    }


    clone.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            handler();
        }
    );
}


function rg25BindSummaryCardByCount(
    countId,
    handler,
    title
) {

    const count =
        document.getElementById(
            countId
        );


    const card =
        count?.closest(
            ".summary-box"
        );


    if (card) {

        rg25ReplaceClickHandler(
            card,
            handler,
            title
        );
    }
}


function rg25RebindSolutionSummary() {

    rg25ReplaceClickHandler(
        document.getElementById(
            "tablesSummary"
        ),
        loadSolutionTables,
        "Explore Tables"
    );


    rg25BindSummaryCardByCount(
        "formCount",
        rg25ShowForms,
        "Explore Forms"
    );


    rg25BindSummaryCardByCount(
        "viewCount",
        rg25ShowViews,
        "Explore Views"
    );


    rg25BindSummaryCardByCount(
        "workflowCount",
        rg26ShowProcesses,
        "Explore Workflows / Processes"
    );


    rg25BindSummaryCardByCount(
        "webResourceCount",
        rg25ShowWebResources,
        "Explore Web Resources"
    );


    rg25BindSummaryCardByCount(
        "choiceCount",
        rg25ShowChoices,
        "Explore Choices"
    );
    if (typeof rgWorkflow !== "undefined") rgWorkflow.compactOverview();

}


// ============================================================
// DEPLOYMENT COMPONENT SHORTCUTS
// ============================================================

function rg25AddExplorerShortcuts() {

    const analysisCard =
        document.getElementById(
            "analysisCard"
        );


    if (
        !analysisCard ||
        document.getElementById(
            "rg25PlatformComponents"
        )
    ) {

        return;
    }


    const section =
        document.createElement(
            "div"
        );


    section.id =
        "rg25PlatformComponents";


    section.className =
        "rg25-shortcut-section";


    section.innerHTML = `

        <h3>
            Deployment Components
        </h3>

        <div class="rg25-shortcut-grid">

            <button
                type="button"
                data-action="environment"
            >
                Environment Variables
            </button>

            <button
                type="button"
                data-action="connections"
            >
                Connection References
            </button>

            <button
                type="button"
                data-action="assemblies"
            >
                Plug-in Assemblies
            </button>

            <button
                type="button"
                data-action="steps"
            >
                Plug-in Steps
            </button>

        </div>
    `;


    analysisCard.appendChild(
        section
    );


    const routes = {

        environment:
            rg25ShowEnvironmentVariables,

        connections:
            rg25ShowConnectionReferences,

        assemblies:
            rg25ShowPluginAssemblies,

        steps:
            rg25ShowPluginSteps
    };


    Object.entries(
        routes
    )
        .forEach(
            function (
                [
                    key,
                    handler
                ]
            ) {

                section
                    .querySelector(
                        `[data-action="${key}"]`
                    )
                    ?.addEventListener(
                        "click",
                        handler
                    );
            }
        );
    if (typeof rgWorkflow !== "undefined") rgWorkflow.compactOverview();

}


// ============================================================
// COMPONENT LABEL HELPERS
// ============================================================

function rg25WorkflowType(
    value
) {

    return (
        {
            1:
                "Definition",

            2:
                "Activation",

            3:
                "Template"

        }[value] ||
        `Type ${value}`
    );
}


function rg25WebResourceType(
    value
) {

    return (
        {
            1: "HTML",
            2: "CSS",
            3: "JavaScript",
            4: "XML",
            5: "PNG",
            6: "JPG",
            7: "GIF",
            8: "Silverlight",
            9: "XSL",
            10: "ICO",
            11: "SVG",
            12: "RESX"

        }[value] ||
        `Type ${value}`
    );
}


function rg25ComponentState(
    value
) {

    return (
        {
            0:
                "Published",

            1:
                "Unpublished",

            2:
                "Deleted",

            3:
                "Deleted Unpublished"

        }[value] ||
        `State ${value}`
    );
}


function rg25EnvironmentVariableType(
    value
) {

    return (
        {
            100000000:
                "String",

            100000001:
                "Number",

            100000002:
                "Boolean",

            100000003:
                "JSON",

            100000004:
                "Data Source",

            100000005:
                "Secret"

        }[value] ||
        `Type ${value}`
    );
}


function rg25IsolationMode(
    value
) {

    return (
        {
            1:
                "None",

            2:
                "Sandbox",

            3:
                "External"

        }[value] ||
        `Mode ${value}`
    );
}


function rg25PluginSource(
    value
) {

    return (
        {
            0:
                "Database",

            1:
                "Disk",

            2:
                "Normal",

            3:
                "Azure Web App",

            4:
                "File Store"

        }[value] ||
        `Source ${value}`
    );
}


function rg25PluginStage(
    value
) {

    return (
        {
            10:
                "Pre-validation",

            20:
                "Pre-operation",

            40:
                "Post-operation",

            50:
                "Post-operation (Deprecated)"

        }[value] ||
        `Stage ${value}`
    );
}


function rg25PluginMode(
    value
) {

    return (
        value ===
            1
            ? "Asynchronous"
            : "Synchronous"
    );
}


function rg25PluginDeployment(
    value
) {

    return (
        {
            0:
                "Server Only",

            1:
                "Outlook Client Only",

            2:
                "Both"

        }[value] ||
        `Deployment ${value}`
    );
}


function rg25FormatDate(
    value
) {

    if (!value) {

        return "";
    }


    try {

        return new Date(
            value
        )
            .toLocaleString();
    }
    catch {

        return String(
            value
        );
    }
}
// ============================================================
// PROFESSIONAL UI INITIALIZATION
// ============================================================

let rg26ProcessFilter =
    "all";

let rg26SplashVisible =
    false;

let rgSplashHasShown =
    false;


let rg28TargetTabId =
    null;

let rg28TargetSolutions =
    [];

let rg28TargetSolutionId =
    null;

let rg28TargetSolutionComponents =
    [];

let rg28LastComparison =
    null;


// ============================================================
// START PROFESSIONAL UI
// ============================================================

window.setTimeout(
    function () {

        try {

            rgInitializeOneTimeSplash();

            rg26UpgradeNavigation();

            rg26InstallProcessExplorer();

            rgInstallExplorerHome();

            rgInstallTargetComparison();

        }
        catch (error) {

            console.error(
                "Release Guardian UI initialization failed:",
                error
            );
        }

    },
    350
);


// ============================================================
// ONE-TIME SPLASH
// ============================================================

function rgInitializeOneTimeSplash() {

    if (
        rgSplashHasShown
    ) {

        return;
    }


    const splash =
        document.getElementById(
            "rg26Splash"
        );


    if (!splash) {

        return;
    }


    rgSplashHasShown =
        true;


    splash.addEventListener(
        "click",
        rg26HideSplash,
        {
            once: true
        }
    );


    rg26ShowSplash();
}


function rg26ShowSplash(
    duration = 1400
) {

    const splash =
        document.getElementById(
            "rg26Splash"
        );


    if (
        !splash ||
        rg26SplashVisible
    ) {

        return;
    }


    rg26SplashVisible =
        true;


    splash.setAttribute(
        "aria-hidden",
        "false"
    );


    splash.classList.remove(
        "rg26-splash-hide"
    );


    splash.style.display =
        "flex";


    requestAnimationFrame(
        function () {

            splash.classList.add(
                "rg26-splash-show"
            );
        }
    );


    window.setTimeout(
        rg26HideSplash,
        duration
    );
}


function rg26HideSplash() {

    const splash =
        document.getElementById(
            "rg26Splash"
        );


    if (!splash) {

        return;
    }


    splash.classList.remove(
        "rg26-splash-show"
    );


    splash.classList.add(
        "rg26-splash-hide"
    );


    splash.setAttribute(
        "aria-hidden",
        "true"
    );


    window.setTimeout(
        function () {

            splash.style.display =
                "none";


            rg26SplashVisible =
                false;

        },
        220
    );
}


// ============================================================
// NAVIGATION ICONS
// ============================================================

function rg26UpgradeNavigation() {

    const navigation =
        document.getElementById(
            "rgAppNavigation"
        );


    if (!navigation) {

        return;
    }


    const icons = {

        home: `
            <svg viewBox="0 0 24 24">
                <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4Z"/>
            </svg>
        `,

        solution: `
            <svg viewBox="0 0 24 24">
                <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/>
                <path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>
            </svg>
        `,

        explorer: `
            <svg viewBox="0 0 24 24">
                <circle cx="10" cy="10" r="6"/>
                <path d="m15 15 5 5"/>
            </svg>
        `,

        readiness: `
            <svg viewBox="0 0 24 24">
                <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z"/>
                <path d="m8.5 12 2.2 2.2 4.8-5"/>
            </svg>
        `
    };


    navigation
        .querySelectorAll(
            ".rg-nav-button"
        )
        .forEach(
            function (button) {

                if (
                    button.dataset.rg26Upgraded ===
                    "true"
                ) {

                    return;
                }


                const screen =
                    button.dataset.rgScreen;


                const label =
                    button.textContent
                        .trim();


                button.innerHTML = `

                    <span class="rg26-nav-icon">

                        ${icons[
                    screen
                    ] || ""}

                    </span>

                    <span>
                        ${rgEscapeHtml(
                        label
                    )}
                    </span>
                `;


                button.dataset.rg26Upgraded =
                    "true";
            }
        );
}


// ============================================================
// PROCESS EXPLORER
// ============================================================

function rg26InstallProcessExplorer() {

    window.rg25ShowProcesses =
        rg26ShowProcesses;
}


async function rg26ShowProcesses() {

    rgShowScreen(
        "explorer"
    );


    const explorer =
        rg25ResetExplorer();


    if (!explorer) {

        return;
    }


    const loading =
        document.createElement(
            "div"
        );


    loading.className =
        "rg-inline-loading";


    loading.innerHTML = `

        <span class="rg-inline-spinner"></span>

        <span>
            Loading processes...
        </span>
    `;


    explorer.appendChild(
        loading
    );


    try {

        const data =
            await rg25LoadExplorerData();


        rg26RenderProcessExplorer(
            data.workflows ||
            []
        );
    }
    catch (error) {

        loading.innerHTML = `

            <div class="rg-warning">

                ${rgEscapeHtml(
            error?.message ||
            String(error)
        )}

            </div>
        `;
    }
}


function rg26RenderProcessExplorer(
    records
) {

    const explorer =
        rg25ResetExplorer();


    if (!explorer) {

        return;
    }


    const page =
        document.createElement(
            "section"
        );


    page.className =
        "rg26-process-page";


    page.innerHTML = `

        <div class="rg26-page-heading">

            <div>

                <span class="rg26-section-eyebrow">
                    COMPONENT EXPLORER
                </span>

                <h2>
                    Workflows / Processes
                </h2>

                <p>
                    ${records.length}
                    process component(s) resolved.
                </p>

            </div>

        </div>


        <div class="rg26-process-toolbar">

            <div class="rg26-filter-chips">

                ${rg26ProcessFilterButton(
        records,
        "all",
        "All"
    )}

                ${rg26ProcessFilterButton(
        records,
        "modern",
        "Modern Flow"
    )}

                ${rg26ProcessFilterButton(
        records,
        "businessRule",
        "Business Rule"
    )}

                ${rg26ProcessFilterButton(
        records,
        "workflow",
        "Workflow"
    )}

                ${rg26ProcessFilterButton(
        records,
        "action",
        "Action"
    )}

                ${rg26ProcessFilterButton(
        records,
        "bpf",
        "BPF"
    )}

            </div>


            <div class="rg26-process-search-wrap">

                <input
                    id="rg26ProcessSearch"
                    type="search"
                    placeholder="Search processes..."
                />

            </div>

        </div>


        <div class="rg26-process-summary">

            <span>

                <strong id="rg26VisibleProcessCount">
                    ${records.length}
                </strong>

                shown

            </span>

        </div>


        <div
            id="rg26ProcessList"
            class="rg26-process-list"
        ></div>
    `;


    explorer.appendChild(
        page
    );


    page
        .querySelector(
            "#rg26ProcessSearch"
        )
        ?.addEventListener(
            "input",
            function () {

                rg26RenderProcessList(
                    records
                );
            }
        );


    page
        .querySelectorAll(
            "[data-process-filter]"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        rg26ProcessFilter =
                            button.dataset.processFilter;


                        page
                            .querySelectorAll(
                                "[data-process-filter]"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        button.classList.add(
                            "active"
                        );


                        rg26RenderProcessList(
                            records
                        );
                    }
                );
            }
        );


    rg26RenderProcessList(
        records
    );
}


function rg26ProcessFilterButton(
    records,
    filter,
    label
) {

    const count =
        records.filter(
            record =>
                rg26ProcessMatchesFilter(
                    record,
                    filter
                )
        ).length;


    return `

        <button
            type="button"
            class="rg26-filter-chip ${filter === "all"
            ? "active"
            : ""
        }"
            data-process-filter="${filter}"
        >

            ${rgEscapeHtml(
            label
        )}

            <span>
                ${count}
            </span>

        </button>
    `;
}


function rg26ProcessMatchesFilter(
    record,
    filter
) {

    if (
        filter ===
        "all"
    ) {

        return true;
    }


    const category =
        Number(
            record.category
        );


    const map = {

        modern:
            5,

        businessRule:
            2,

        workflow:
            0,

        action:
            3,

        bpf:
            4
    };


    return (
        category ===
        map[
        filter
        ]
    );
}


function rg26RenderProcessList(
    records
) {

    const container =
        document.getElementById(
            "rg26ProcessList"
        );


    if (!container) {

        return;
    }


    const search =
        String(
            document.getElementById(
                "rg26ProcessSearch"
            )?.value ||
            ""
        )
            .toLowerCase()
            .trim();


    const filtered =
        records.filter(
            function (record) {

                if (
                    !rg26ProcessMatchesFilter(
                        record,
                        rg26ProcessFilter
                    )
                ) {

                    return false;
                }


                if (!search) {

                    return true;
                }


                return [

                    record.name,
                    record.uniquename,
                    rg26CleanPrimaryTable(
                        record.primaryentity
                    ),
                    getProcessCategoryName(
                        record.category
                    ),
                    getWorkflowStateName(
                        record.statecode
                    )

                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(
                        search
                    );
            }
        );


    rgSetText(
        "rg26VisibleProcessCount",
        filtered.length
    );


    container.innerHTML =
        "";


    if (
        !filtered.length
    ) {

        container.innerHTML = `

            <div class="rg26-empty-state">

                <strong>
                    No matching processes
                </strong>

                <span>
                    Try another filter or search term.
                </span>

            </div>
        `;

        return;
    }


    filtered.forEach(
        function (record) {

            const row =
                document.createElement(
                    "button"
                );


            row.type =
                "button";


            row.className =
                "rg26-process-row";


            const primaryTable =
                rg26CleanPrimaryTable(
                    record.primaryentity
                );


            row.innerHTML = `

                <div class="rg26-process-row-content">

                    <strong>

                        ${rgEscapeHtml(
                record.name ||
                "Unnamed Process"
            )}

                    </strong>


                    ${primaryTable
                    ? `
                                <span class="rg26-process-table">

                                    ${rgEscapeHtml(
                        primaryTable
                    )}

                                </span>
                            `
                    : ""
                }


                    <div class="rg26-process-badges">

                        <span class="rg26-type-badge">

                            ${rgEscapeHtml(
                    getProcessCategoryName(
                        record.category
                    )
                )}

                        </span>


                        <span class="rg26-status-badge">

                            ${rgEscapeHtml(
                    getWorkflowStateName(
                        record.statecode
                    )
                )}

                        </span>

                    </div>

                </div>


                <div class="rg27-card-arrow">
                    ›
                </div>
            `;


            row.addEventListener(
                "click",
                function () {

                    rg26ShowProcessDetails(
                        record
                    );
                }
            );


            container.appendChild(
                row
            );
        }
    );
}


function rg26CleanPrimaryTable(
    value
) {

    const text =
        String(
            value ||
            ""
        )
            .trim();


    if (
        !text ||
        [
            "none",
            "null",
            "-"
        ]
            .includes(
                text.toLowerCase()
            )
    ) {

        return "";
    }


    return text;
}


// ============================================================
// PROCESS DETAILS
// ============================================================

function rg26ShowProcessDetails(
    record
) {

    const explorer =
        rg25ResetExplorer();


    if (!explorer) {

        return;
    }


    const category =
        getProcessCategoryName(
            record.category
        );


    const status =
        getWorkflowStateName(
            record.statecode
        );


    const primaryTable =
        rg26CleanPrimaryTable(
            record.primaryentity
        );


    const page =
        document.createElement(
            "section"
        );


    page.className =
        "rg26-process-detail-page";


    page.innerHTML = `

        <button
            type="button"
            id="rg26BackProcesses"
            class="rg26-back-button"
        >
            ← Workflows / Processes
        </button>


        <div class="rg26-detail-hero">

            <div class="rg26-detail-title">

                <span class="rg26-section-eyebrow">
                    PROCESS DETAILS
                </span>

                <h2>

                    ${rgEscapeHtml(
        record.name ||
        "Unnamed Process"
    )}

                </h2>


                ${record.uniquename
            ? `
                            <code>

                                ${rgEscapeHtml(
                record.uniquename
            )}

                            </code>
                        `
            : ""
        }

            </div>

        </div>


        <div class="rg26-detail-grid">

            ${rg26DetailMetric(
            "Type",
            category
        )}

            ${rg26DetailMetric(
            "Status",
            status
        )}

            ${rg26DetailMetric(
            "Primary Table",
            primaryTable ||
            "Not specified"
        )}

            ${rg26DetailMetric(
            "Managed",
            record.ismanaged
                ? "Yes"
                : "No"
        )}

            ${rg26DetailMetric(
            "Execution",
            record.mode ===
                1
                ? "Real-time"
                : "Background"
        )}

            ${rg26DetailMetric(
            "On Demand",
            record.ondemand
                ? "Yes"
                : "No"
        )}

        </div>


        <div class="rg26-detail-section">

            <span class="rg26-section-eyebrow">
                PROCESS INFORMATION
            </span>

            <div class="rg26-info-list">

                ${rg26InfoRow(
            "Workflow ID",
            record.workflowid
        )}

                ${rg26InfoRow(
            "Workflow Unique ID",
            record.workflowidunique
        )}

                ${rg26InfoRow(
            "Unique Name",
            record.uniquename
        )}

                ${rg26InfoRow(
            "Component State",
            rg25ComponentState(
                record.componentstate
            )
        )}

                ${rg26InfoRow(
            "Modified",
            rg25FormatDate(
                record.modifiedon
            )
        )}

            </div>

        </div>


        <div class="rg26-detail-section">

            <div class="rg26-detail-section-title">

                <div>

                    <span class="rg26-section-eyebrow">
                        DATAVERSE
                    </span>

                    <h3>
                        Dependencies
                    </h3>

                </div>


                <button
                    type="button"
                    id="rg26RefreshProcessDependencies"
                    class="rg26-mini-button"
                >
                    Refresh
                </button>

            </div>


            <div
                id="rg26ProcessDependencyStatus"
                class="rg26-dependency-loading"
            >
                Loading Dataverse dependencies...
            </div>


            <div
                id="rg26ProcessDependencySummary"
                class="rg26-process-dependency-summary"
                style="display:none;"
            >

                <div>

                    <span>
                        Used By
                    </span>

                    <strong id="rg26ProcessUsedBy">
                        0
                    </strong>

                </div>


                <div>

                    <span>
                        Depends On
                    </span>

                    <strong id="rg26ProcessDependsOn">
                        0
                    </strong>

                </div>

            </div>


            <div
                id="rg26ProcessDependencyPreview"
                class="rg26-dependency-preview"
            ></div>

        </div>
    `;


    explorer.appendChild(
        page
    );


    page
        .querySelector(
            "#rg26BackProcesses"
        )
        ?.addEventListener(
            "click",
            rg26ShowProcesses
        );


    page
        .querySelector(
            "#rg26RefreshProcessDependencies"
        )
        ?.addEventListener(
            "click",
            function () {

                rg26LoadProcessDependencies(
                    record
                );
            }
        );


    rg26LoadProcessDependencies(
        record
    );
}


function rg26DetailMetric(
    label,
    value
) {

    return `

        <div class="rg26-detail-metric">

            <span>
                ${rgEscapeHtml(
        label
    )}
            </span>

            <strong>

                ${rgEscapeHtml(
        value ||
        "-"
    )}

            </strong>

        </div>
    `;
}


function rg26InfoRow(
    label,
    value
) {

    if (
        value ===
        undefined ||
        value ===
        null ||
        value ===
        ""
    ) {

        return "";
    }


    return `

        <div class="rg26-info-row">

            <span>
                ${rgEscapeHtml(
        label
    )}
            </span>

            <code>

                ${rgEscapeHtml(
        String(
            value
        )
    )}

            </code>

        </div>
    `;
}


function rg26LoadProcessDependencies(
    record
) {

    const status =
        document.getElementById(
            "rg26ProcessDependencyStatus"
        );


    const objectId =
        record.workflowidunique ||
        record.workflowid;


    if (!objectId) {

        if (status) {

            status.textContent =
                "Process ID is unavailable.";
        }

        return;
    }


    sendDynamicsMessage(
        {
            action:
                "getDependencyBundle",

            objectId,

            componentType:
                29
        },

        function (response) {

            if (
                !response?.success
            ) {

                if (status) {

                    status.textContent =
                        "Dependency lookup failed.";
                }

                return;
            }


            const dependents =
                response.dependents ||
                [];


            const required =
                response.required ||
                [];


            rgSetText(
                "rg26ProcessUsedBy",
                dependents.length
            );


            rgSetText(
                "rg26ProcessDependsOn",
                required.length
            );


            const summary =
                document.getElementById(
                    "rg26ProcessDependencySummary"
                );


            if (summary) {

                summary.style.display =
                    "grid";
            }


            if (status) {

                status.textContent =
                    "Dependency graph loaded from Dataverse.";
            }


            rg26RenderProcessDependencyPreview(
                dependents,
                required
            );
        },

        function (message) {

            if (status) {

                status.textContent =
                    message ||
                    "Dependency lookup unavailable.";
            }
        }
    );
}


function rg26RenderProcessDependencyPreview(
    dependents,
    required
) {

    const container =
        document.getElementById(
            "rg26ProcessDependencyPreview"
        );


    if (!container) {

        return;
    }


    const records = [

        ...dependents.map(
            item => ({
                direction:
                    "Used by",

                type:
                    item.dependentcomponenttype,

                dependencyType:
                    item.dependencytype
            })
        ),

        ...required.map(
            item => ({
                direction:
                    "Depends on",

                type:
                    item.requiredcomponenttype,

                dependencyType:
                    item.dependencytype
            })
        )

    ];


    if (
        !records.length
    ) {

        container.innerHTML = `

            <div class="rg26-no-dependencies">
                No direct dependency records were returned.
            </div>
        `;

        return;
    }


    container.innerHTML =
        records
            .slice(
                0,
                12
            )
            .map(
                item => `

                    <div class="rg26-dependency-item">

                        <div>

                            <span>
                                ${rgEscapeHtml(
                    item.direction
                )}
                            </span>

                            <strong>

                                ${rgEscapeHtml(
                    rgComponentTypeName(
                        item.type
                    )
                )}

                            </strong>

                        </div>


                        <small>

                            ${rgEscapeHtml(
                    rgDependencyTypeName(
                        item.dependencyType
                    )
                )}

                        </small>

                    </div>
                `
            )
            .join(
                ""
            );
}


// ============================================================
// EXPLORER LANDING PAGE
// ============================================================

function rgInstallExplorerHome() {

    const button =
        document.querySelector(
            '[data-rg-screen="explorer"]'
        );


    if (!button) {

        return;
    }


    button.addEventListener(
        "click",
        function () {

            window.setTimeout(
                function () {

                    if (
                        rgCurrentScreen ===
                        "explorer"
                    ) {

                        rg27ShowExplorerHome();
                    }

                },
                0
            );
        }
    );
}


async function rg27ShowExplorerHome() {

    rgShowScreen(
        "explorer"
    );


    const explorer =
        rg25ResetExplorer();


    if (!explorer) {

        return;
    }


    const page =
        document.createElement(
            "section"
        );


    page.className =
        "rg27-explorer-home";


    page.innerHTML = `

        <div class="rg27-explorer-hero">

            <div>

                <span class="rg26-section-eyebrow">
                    SOLUTION EXPLORER
                </span>

                <h2>
                    Component Explorer
                </h2>

                <p>
                    Inspect components, metadata and dependencies.
                </p>

            </div>

        </div>


        <div
            id="rg27ExplorerStats"
            class="rg27-explorer-grid"
        >

            <div class="rg-inline-loading">
                Loading component catalog...
            </div>

        </div>
    `;


    explorer.appendChild(
        page
    );


    try {

        const data =
            await rg25LoadExplorerData();


        rg27RenderExplorerHome(
            data
        );
    }
    catch (error) {

        document.getElementById(
            "rg27ExplorerStats"
        ).innerHTML = `

            <div class="rg-warning">

                ${rgEscapeHtml(
            error?.message ||
            String(error)
        )}

            </div>
        `;
    }
}


function rg27RenderExplorerHome(
    data
) {

    const container =
        document.getElementById(
            "rg27ExplorerStats"
        );


    if (!container) {

        return;
    }


    const cards = [

        {
            title:
                "Tables",

            count:
                analyzedComponents.filter(
                    item =>
                        item.componenttype ===
                        1
                ).length,

            action:
                loadSolutionTables
        },

        {
            title:
                "Forms",

            count:
                data.forms?.length ||
                0,

            action:
                rg25ShowForms
        },

        {
            title:
                "Views",

            count:
                data.views?.length ||
                0,

            action:
                rg25ShowViews
        },

        {
            title:
                "Processes",

            count:
                data.workflows?.length ||
                0,

            action:
                rg26ShowProcesses
        },

        {
            title:
                "Web Resources",

            count:
                data.webResources?.length ||
                0,

            action:
                rg25ShowWebResources
        },

        {
            title:
                "Choices",

            count:
                data.choices?.length ||
                0,

            action:
                rg25ShowChoices
        },

        {
            title:
                "Environment Variables",

            count:
                data.environmentVariables?.length ||
                0,

            action:
                rg25ShowEnvironmentVariables
        },

        {
            title:
                "Connection References",

            count:
                data.connectionReferences?.length ||
                0,

            action:
                rg25ShowConnectionReferences
        },

        {
            title:
                "Plug-in Assemblies",

            count:
                data.pluginAssemblies?.length ||
                0,

            action:
                rg25ShowPluginAssemblies
        },

        {
            title:
                "Plug-in Steps",

            count:
                data.pluginSteps?.length ||
                0,

            action:
                rg25ShowPluginSteps
        }
    ];


    container.innerHTML =
        "";


    cards.forEach(
        function (card) {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "rg27-explorer-card";


            button.innerHTML = `

                <div>

                    <span>
                        ${rgEscapeHtml(
                card.title
            )}
                    </span>

                    <strong>
                        ${card.count}
                    </strong>

                </div>

                <span class="rg27-card-arrow">
                    →
                </span>
            `;


            button.addEventListener(
                "click",
                card.action
            );


            container.appendChild(
                button
            );
        }
    );
}


// ============================================================
// TARGET ENVIRONMENT / SOLUTION COMPARISON
// ============================================================

function rgInstallTargetComparison() {

    const readinessButton =
        document.querySelector(
            '[data-rg-screen="readiness"]'
        );


    readinessButton
        ?.addEventListener(
            "click",
            function () {

                window.setTimeout(
                    rg28CreateTargetComparisonPanel,
                    0
                );
            }
        );
}


function rg28CreateTargetComparisonPanel() {

    if (
        document.getElementById(
            "rg28TargetPanel"
        )
    ) {

        rg282UpdateSourceSolution();

        return;
    }


    const readiness =
        document.getElementById(
            "rgScreenReadiness"
        );


    if (!readiness) {

        return;
    }


    const panel =
        document.createElement(
            "section"
        );


    panel.id =
        "rg28TargetPanel";


    panel.className =
        "card rg28-target-panel";


    panel.innerHTML = `

        <div class="rg28-panel-header">

            <div>

                <span class="rg26-section-eyebrow">
                    CROSS-ENVIRONMENT PREFLIGHT
                </span>

                <h2>
                    DEV → Target Comparison
                </h2>

                <p>
                    Compare the selected source solution
                    with a solution in another open Dynamics environment.
                </p>

            </div>

        </div>


        <div class="rg282-source-target-grid">

            <div class="rg282-environment-card">

                <span class="rg282-environment-label">
                    SOURCE
                </span>

                <strong id="rg28SourceEnvironment">
                    -
                </strong>

                <span id="rg282SourceSolutionName">
                    Select and analyze a solution
                </span>

                <small id="rg282SourceSolutionUniqueName">
                    -
                </small>

                <small>
                    Version:
                    <span id="rg282SourceVersion">
                        -
                    </span>
                </small>

            </div>


            <div class="rg282-environment-card">

                <span class="rg282-environment-label">
                    TARGET
                </span>


                <label for="rg28TargetTabSelect">
                    Environment
                </label>

                <select id="rg28TargetTabSelect">

                    <option value="">
                        Select target Dynamics tab
                    </option>

                </select>


                <button
                    type="button"
                    id="rg28RefreshTargets"
                    class="secondary-button"
                >
                    Refresh Environments
                </button>


                <button
                    type="button"
                    id="rg28VerifyTarget"
                    class="secondary-button"
                    disabled
                >
                    Verify & Load Solutions
                </button>


                <label for="rg282TargetSolutionSelect">
                    Target Solution
                </label>

                <select
                    id="rg282TargetSolutionSelect"
                    disabled
                >

                    <option value="">
                        Verify environment first
                    </option>

                </select>


                <div
                    id="rg282TargetSolutionInfo"
                    class="rg282-target-solution-info"
                ></div>

            </div>

        </div>


        <button
            type="button"
            id="rg28RunPreflight"
            class="rg28-primary-action"
            disabled
        >
            Compare Solutions & Run Preflight
        </button>


        <div
            id="rg28TargetStatus"
            class="rg28-status-box"
        >
            Open UAT in another Dynamics tab,
            then refresh the environments.
        </div>


        <div
            id="rg282SolutionComparison"
            style="display:none;"
        ></div>


        <div
            id="rg28ComparisonResults"
            style="display:none;"
        ></div>
    `;


    const readinessPanel =
        document.getElementById(
            "rgReadinessPanel"
        );


    if (
        readinessPanel &&
        readinessPanel.parentNode ===
        readiness
    ) {

        readiness.insertBefore(
            panel,
            readinessPanel
        );
    }

    else {

        readiness.appendChild(
            panel
        );
    }


    document
        .getElementById(
            "rg28RefreshTargets"
        )
        ?.addEventListener(
            "click",
            rg28RefreshTargetTabs
        );


    document
        .getElementById(
            "rg28VerifyTarget"
        )
        ?.addEventListener(
            "click",
            rg28VerifyTargetAndLoadSolutions
        );


    document
        .getElementById(
            "rg28RunPreflight"
        )
        ?.addEventListener(
            "click",
            rg282CompareAndRunPreflight
        );


    document
        .getElementById(
            "rg28TargetTabSelect"
        )
        ?.addEventListener(
            "change",
            rg282TargetTabChanged
        );


    document
        .getElementById(
            "rg282TargetSolutionSelect"
        )
        ?.addEventListener(
            "change",
            rg282TargetSolutionChanged
        );


    rg282UpdateSourceSolution();

    rg28RefreshTargetTabs();
}


// ============================================================
// SOURCE SOLUTION
// ============================================================

function rg282GetSourceSolution() {

    const id =
        document.getElementById(
            "solutionSelect"
        )?.value;


    return loadedSolutions.find(
        solution =>
            solution.solutionid ===
            id
    ) ||
        null;
}


async function rg282UpdateSourceSolution() {

    const solution =
        rg282GetSourceSolution();


    try {

        const tabs =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        if (typeof rgWorkflow !== "undefined" && rgWorkflow.sourceTabId) {
            tabs[0] = await chrome.tabs.get(rgWorkflow.sourceTabId);
        }

        if (
            tabs[0]?.url
        ) {

            const url =
                new URL(
                    tabs[0].url
                );


            rgSetText(
                "rg28SourceEnvironment",
                url.hostname
            );
        }
    }
    catch {

        // Non-blocking.
    }


    if (!solution) {

        rgSetText(
            "rg282SourceSolutionName",
            "Select and analyze a solution"
        );

        rgSetText(
            "rg282SourceSolutionUniqueName",
            "-"
        );

        rgSetText(
            "rg282SourceVersion",
            "-"
        );

        return;
    }


    rgSetText(
        "rg282SourceSolutionName",
        solution.friendlyname ||
        solution.uniquename
    );


    rgSetText(
        "rg282SourceSolutionUniqueName",
        solution.uniquename ||
        "-"
    );


    rgSetText(
        "rg282SourceVersion",
        solution.version ||
        "-"
    );
}


// ============================================================
// TARGET TAB DISCOVERY
// ============================================================

async function rg28RefreshTargetTabs() {

    const select =
        document.getElementById(
            "rg28TargetTabSelect"
        );


    if (!select) {

        return;
    }


    const previous =
        select.value;


    select.innerHTML = `

        <option value="">
            Select target Dynamics tab
        </option>
    `;


    const tabs =
        await chrome.tabs.query({});


    const dynamicsTabs =
        tabs.filter(
            tab =>
                tab.id &&
                tab.url &&
                tab.url.includes(
                    "dynamics.com"
                )
        );


    let activeTabId =
        null;


    try {

        const active =
            await chrome.tabs.query({
                active: true,
                currentWindow: true
            });


        activeTabId =
            active[0]?.id ||
            null;
    }
    catch {

        // Ignore.
    }


    if (typeof rgWorkflow !== "undefined" && rgWorkflow.sourceTabId) activeTabId = rgWorkflow.sourceTabId;

    dynamicsTabs
        .filter(
            tab =>
                tab.id !==
                activeTabId
        )
        .forEach(
            function (tab) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    String(
                        tab.id
                    );


                try {

                    const url =
                        new URL(
                            tab.url
                        );


                    option.textContent =
                        url.hostname;
                }
                catch {

                    option.textContent =
                        tab.title ||
                        `Dynamics Tab ${tab.id}`;
                }


                select.appendChild(
                    option
                );
            }
        );


    if (
        previous &&
        [
            ...select.options
        ]
            .some(
                option =>
                    option.value ===
                    previous
            )
    ) {

        select.value =
            previous;
    }


    rg282TargetTabChanged({
        target:
            select
    });
}


function rg282TargetTabChanged(
    event
) {

    rg28TargetTabId =
        event.target.value
            ? Number(
                event.target.value
            )
            : null;


    rg28TargetSolutions =
        [];


    rg28TargetSolutionId =
        null;


    rg28TargetSolutionComponents =
        [];


    const verify =
        document.getElementById(
            "rg28VerifyTarget"
        );


    if (verify) {

        verify.disabled =
            !rg28TargetTabId;
    }


    const targetSolution =
        document.getElementById(
            "rg282TargetSolutionSelect"
        );


    if (targetSolution) {

        targetSolution.disabled =
            true;


        targetSolution.innerHTML = `

            <option value="">
                Verify environment first
            </option>
        `;
    }


    if (typeof rgWorkflow !== "undefined") rgWorkflow.targetChanged();
    rg282UpdateCompareButton();
}


// ============================================================
// MESSAGE A SPECIFIC DYNAMICS TAB
// ============================================================

function rg28SendMessageToTab(
    tabId,
    message,
    success,
    failure
) {

    if (!tabId) {

        failure?.(
            "Select a target Dynamics environment."
        );

        return;
    }


    chrome.tabs.sendMessage(
        tabId,
        message,
        function (response) {

            if (
                chrome.runtime.lastError
            ) {

                failure?.(
                    chrome.runtime
                        .lastError
                        .message ||
                    "Target content script unavailable."
                );

                return;
            }


            success?.(
                response
            );
        }
    );
}


// ============================================================
// VERIFY TARGET + LOAD TARGET SOLUTIONS
// ============================================================

function rg28VerifyTargetAndLoadSolutions() {

    if (!rg28TargetTabId) {

        return;
    }


    const targetTabId = rg28TargetTabId;
    const targetVersion = typeof rgWorkflow !== "undefined" ? rgWorkflow.contextRevision : 0;
    rg28SetStatus(
        "Verifying target environment...",
        "loading"
    );


    rg28SendMessageToTab(
        rg28TargetTabId,

        {
            action:
                "whoAmI"
        },

        function (whoResponse) {
            if (rg28TargetTabId !== targetTabId ||
                typeof rgWorkflow !== "undefined" && rgWorkflow.contextRevision !== targetVersion) return;

            if (
                !whoResponse?.success
            ) {

                rg28SetStatus(
                    "Target environment verification failed.",
                    "warning"
                );

                return;
            }


            rg28SetStatus(
                "Target connected. Loading solutions...",
                "loading"
            );


            rg28SendMessageToTab(
                rg28TargetTabId,

                {
                    action:
                        "getSolutions"
                },

                function (response) {
                    if (rg28TargetTabId !== targetTabId ||
                        typeof rgWorkflow !== "undefined" && rgWorkflow.contextRevision !== targetVersion) return;

                    if (
                        !response?.success
                    ) {

                        rg28SetStatus(
                            "Unable to load target solutions.",
                            "warning"
                        );

                        return;
                    }


                    rg28TargetSolutions =
                        response.solutions ||
                        [];


                    rg282PopulateTargetSolutions();

                    rg28SetStatus(
                        `${rg28TargetSolutions.length} target solutions loaded.`,
                        "success"
                    );
                },

                function (message) {
                    if (rg28TargetTabId !== targetTabId ||
                        typeof rgWorkflow !== "undefined" && rgWorkflow.contextRevision !== targetVersion) return;

                    rg28SetStatus(
                        message,
                        "warning"
                    );
                }
            );
        },

        function (message) {
            if (rg28TargetTabId !== targetTabId ||
                typeof rgWorkflow !== "undefined" && rgWorkflow.contextRevision !== targetVersion) return;

            rg28SetStatus(
                message,
                "warning"
            );
        }
    );
}


// ============================================================
// TARGET SOLUTION DROPDOWN
// ============================================================

function rg282PopulateTargetSolutions() {

    const select =
        document.getElementById(
            "rg282TargetSolutionSelect"
        );


    if (!select) {

        return;
    }


    select.disabled =
        false;


    select.innerHTML = `

        <option value="">
            Select target solution
        </option>
    `;


    rg28TargetSolutions
        .sort(
            (
                a,
                b
            ) =>
                String(
                    a.friendlyname ||
                    a.uniquename
                )
                    .localeCompare(
                        String(
                            b.friendlyname ||
                            b.uniquename
                        )
                    )
        )
        .forEach(
            function (solution) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    solution.solutionid;


                option.textContent =
                    solution.friendlyname ||
                    solution.uniquename;


                select.appendChild(
                    option
                );
            }
        );


    const source =
        rg282GetSourceSolution();


    if (source) {

        const match =
            rg28TargetSolutions.find(
                target =>
                    String(
                        target.uniquename ||
                        ""
                    )
                        .toLowerCase() ===
                    String(
                        source.uniquename ||
                        ""
                    )
                        .toLowerCase()
            );


        if (match) {

            select.value =
                match.solutionid;


            rg28TargetSolutionId =
                match.solutionid;


            rg282RenderTargetSolutionInfo(
                match
            );
        }
    }


    rg282UpdateCompareButton();
}


function rg282TargetSolutionChanged(
    event
) {

    rg28TargetSolutionId =
        event.target.value ||
        null;


    if (typeof rgWorkflow !== "undefined") rgWorkflow.invalidateTarget();

    const selected =
        rg28TargetSolutions.find(
            solution =>
                solution.solutionid ===
                rg28TargetSolutionId
        );


    rg282RenderTargetSolutionInfo(
        selected
    );


    rg282UpdateCompareButton();
}


function rg282RenderTargetSolutionInfo(
    solution
) {

    const container =
        document.getElementById(
            "rg282TargetSolutionInfo"
        );


    if (!container) {

        return;
    }


    if (!solution) {

        container.innerHTML =
            "";

        return;
    }


    container.innerHTML = `

        <strong>

            ${rgEscapeHtml(
        solution.friendlyname ||
        solution.uniquename
    )}

        </strong>

        <span>

            ${rgEscapeHtml(
        solution.uniquename ||
        ""
    )}

        </span>

        <small>

            Version:
            ${rgEscapeHtml(
        solution.version ||
        "-"
    )}

            •

            ${solution.ismanaged
            ? "Managed"
            : "Unmanaged"
        }

        </small>
    `;
}


function rg282UpdateCompareButton() {

    const button =
        document.getElementById(
            "rg28RunPreflight"
        );


    if (!button) {

        return;
    }


    button.disabled =
        !(
            rg282GetSourceSolution() &&
            analyzedComponents.length &&
            rg28TargetTabId &&
            rg28TargetSolutionId &&
            (typeof rgWorkflow === "undefined" || rgWorkflow.sourceReady && !rgWorkflow.targetBusy)
        );
}


// ============================================================
// RUN CROSS-ENVIRONMENT COMPARISON
// ============================================================

function rg282CompareAndRunPreflight() {

    const source =
        rg282GetSourceSolution();


    if (
        !source ||
        !rg28TargetTabId ||
        !rg28TargetSolutionId
    ) {

        return;
    }


    if (typeof rgWorkflow !== "undefined") rgWorkflow.invalidateTarget();
    const contextKey = () => typeof rgWorkflow !== "undefined" ? rgWorkflow.contextKey()
        : `${rg282GetSourceSolution()?.solutionid}:${rg28TargetTabId}:${rg28TargetSolutionId}`;
    const context = contextKey();
    const isCurrent = () => context === contextKey();
    rg28SetStatus(
        "Loading target solution components...",
        "loading"
    );


    rg28SendMessageToTab(
        rg28TargetTabId,

        {
            action:
                "getSolutionComponents",

            solutionId:
                rg28TargetSolutionId
        },

        function (response) {
            if (!isCurrent()) return;

            if (
                !response?.success
            ) {

                rg28SetStatus(
                    "Target solution components could not be loaded.",
                    "warning"
                );

                return;
            }


            rg28TargetSolutionComponents =
                rgNormalizeSolutionInventory(
                    response.components ||
                    []
                );


            rg282RenderDirectSolutionComparison(
                analyzedComponents,
                rg28TargetSolutionComponents
            );


            rg282RunDependencyCoverage(
                source
            );
        },

        function (message) {
            if (!isCurrent()) return;

            rg28SetStatus(
                message,
                "warning"
            );
        }
    );
}


// ============================================================
// DIRECT SOLUTION COMPARISON
// ============================================================

function rg282RenderDirectSolutionComparison(
    sourceComponents,
    targetComponents
) {

    const container =
        document.getElementById(
            "rg282SolutionComparison"
        );


    if (!container) {

        return;
    }


    const normalizedSourceComponents =
        rgNormalizeSolutionInventory(
            sourceComponents
        );


    const normalizedTargetComponents =
        rgNormalizeSolutionInventory(
            targetComponents
        );


    const sourceCounts =
        rg282BuildComponentCounts(
            normalizedSourceComponents
        );


    const targetCounts =
        rg282BuildComponentCounts(
            normalizedTargetComponents
        );


    const targetIds =
        new Set(
            normalizedTargetComponents
                .filter(
                    item =>
                        item.objectid
                )
                .map(
                    item =>
                        `${item.componenttype}:${String(
                            item.objectid
                        ).toLowerCase()}`
                )
        );


    const exactMatches =
        normalizedSourceComponents.filter(
            item =>
                item.objectid &&
                targetIds.has(
                    `${item.componenttype}:${String(
                        item.objectid
                    ).toLowerCase()}`
                )
        ).length;


    const sourceOnlyById =
        Math.max(
            0,
            normalizedSourceComponents.length -
            exactMatches
        );


    container.style.display =
        "block";


    container.innerHTML = `

        <div class="rg282-result-card">

            <span class="rg26-section-eyebrow">
                SOLUTION CONTENT COMPARISON
            </span>

            <h3>
                Source vs Target Package Counts
            </h3>

            <p class="rg282-section-explainer">
                Compares the component counts in the selected source and target solutions.
                This is separate from dependency readiness below.
            </p>


            <div class="rg282-comparison-table">
                <div class="rg282-comparison-row rg-release-count-header"><strong>Type</strong><strong>Source</strong><span></span><strong>Target</strong><strong>Count</strong></div>
                ${rg282ComparisonRow(
        "Tables",
        sourceCounts.tables,
        targetCounts.tables
    )}

                ${rg282ComparisonRow(
        "Columns",
        sourceCounts.columns,
        targetCounts.columns
    )}

                ${rg282ComparisonRow(
        "Forms",
        sourceCounts.forms,
        targetCounts.forms
    )}

                ${rg282ComparisonRow(
        "Views",
        sourceCounts.views,
        targetCounts.views
    )}

                ${rg282ComparisonRow(
        "Processes",
        sourceCounts.processes,
        targetCounts.processes
    )}

                ${rg282ComparisonRow(
        "Web Resources",
        sourceCounts.webResources,
        targetCounts.webResources
    )}

                ${rg282ComparisonRow(
        "Choices",
        sourceCounts.choices,
        targetCounts.choices
    )}

            </div>


            <details class="rg-flow-id-diagnostics"><summary>Advanced ID diagnostics</summary>
            <p>IDs can differ between environments. These counts do not identify missing components or changed definitions.</p>
            <div class="rg28-result-grid">

                ${rg28Metric(
        "Same component IDs",
        exactMatches
    )}

                ${rg28Metric(
        "Different or unmatched IDs",
        sourceOnlyById
    )}

            </div>


            </details>
            <div class="rg282-comparison-note">

                Counts are normalized to unique underlying solution components.
                Unmatched IDs are not automatically missing; Release Guardian checks
                stable component identity separately in Dependency Readiness.

            </div>

        </div>
    `;
}


function rg282BuildComponentCounts(
    components
) {

    const result = {

        tables:
            0,

        columns:
            0,

        forms:
            0,

        views:
            0,

        processes:
            0,

        webResources:
            0,

        choices:
            0
    };


    (
        components ||
        []
    )
        .forEach(
            function (component) {

                switch (
                component.componenttype
                ) {

                    case 1:

                        result.tables++;

                        break;


                    case 2:

                        result.columns++;

                        break;


                    case 60:

                        result.forms++;

                        break;


                    case 26:

                        result.views++;

                        break;


                    case 29:

                        result.processes++;

                        break;


                    case 61:

                        result.webResources++;

                        break;


                    case 9:

                        result.choices++;

                        break;
                }
            }
        );


    return result;
}


function rg282ComparisonRow(
    name,
    source,
    target
) {

    const match =
        Number(
            source
        ) ===
        Number(
            target
        );


    return `

        <div class="rg282-comparison-row">

            <span>
                ${rgEscapeHtml(
        name
    )}
            </span>

            <strong>
                ${source}
            </strong>

            <div>
                →
            </div>

            <strong>
                ${target}
            </strong>

            <span class="rg282-row-status ${match
            ? "rg282-row-match"
            : "rg282-row-review"
        }">

                ${match
            ? "✓"
            : "Review"
        }

            </span>

        </div>
    `;
}


// ============================================================
// DEPENDENCY COVERAGE ACROSS TARGET ENVIRONMENT
// ============================================================

async function rg282RunDependencyCoverage(
    sourceSolution
) {
    const contextKey = () => typeof rgWorkflow !== "undefined" ? rgWorkflow.contextKey()
        : `${rg282GetSourceSolution()?.solutionid}:${rg28TargetTabId}:${rg28TargetSolutionId}`;
    const context = contextKey();
    const isCurrent = () => context === contextKey();


    rg28SetStatus(
        "Solution comparison complete. Resolving source dependency identities...",
        "loading"
    );

    let sourceExplorerData;

    try {
        sourceExplorerData =
            await rg25LoadExplorerData();
    }
    catch (error) {
        if (!isCurrent()) return;
        rg28SetStatus(
            `Source deployment metadata could not be loaded: ${error?.message || String(error)}`,
            "warning"
        );
        return;
    }

    const sourceDependencies =
        rgUniqueMissingComponents
            .filter(
                item =>
                    item.objectId &&
                    !rg25IsZeroGuid(item.objectId)
            )
            .map(
                item => ({
                    objectId: item.objectId,
                    componentType: item.componentType,
                    severity: item.severity,
                    classification: item.classification,
                    reason: item.reason,
                    raw: item.raw || null
                })
            );

    if (!isCurrent()) return;

    sendDynamicsMessage(
        {
            action: "resolveDependencyIdentities",
            dependencies: sourceDependencies
        },
        function (identityResponse) {
            if (!isCurrent()) return;

            if (!identityResponse?.success) {
                rg28SetStatus(
                    identityResponse?.error ||
                    "Source dependency identities could not be resolved.",
                    "warning"
                );
                return;
            }

            const resolvedDependencies =
                identityResponse.dependencies ||
                sourceDependencies;

            rg28SetStatus(
                "Source identities resolved. Checking exact and stable matches in the target environment...",
                "loading"
            );

            rg28SendMessageToTab(
                rg28TargetTabId,
                {
                    action: "getTargetPreflightSnapshot",
                    solutionUniqueName: sourceSolution.uniquename,
                    requiredComponents: resolvedDependencies,
                    dependencyIdentities: resolvedDependencies,
                    environmentVariables:
                        sourceExplorerData.environmentVariables || [],
                    connectionReferences:
                        sourceExplorerData.connectionReferences || [],
                    pluginAssemblies:
                        sourceExplorerData.pluginAssemblies || []
                },
                function (response) {
                    if (!isCurrent()) return;

                    if (!response?.success) {
                        rg28SetStatus(
                            response?.error ||
                            "Dependency coverage could not be completed.",
                            "warning"
                        );
                        return;
                    }

                    rg28LastComparison =
                        rg282BuildDependencyComparison(
                            sourceSolution,
                            resolvedDependencies,
                            sourceExplorerData,
                            response
                        );

                    rg282RenderDependencyComparison(
                        rg28LastComparison
                    );

                    rg282ApplyTargetEvidenceToReadinessList(
                        rg28LastComparison
                    );

                    rg282ApplyTargetReadinessToMainPanel(
                        rg28LastComparison
                    );

                    rgRenderReadinessDependencies();

                    rg28SetStatus(
                        "Solution comparison and dependency preflight completed.",
                        "success"
                    );
                },
                function (message) {
                    if (!isCurrent()) return;
                    rg28SetStatus(
                        message,
                        "warning"
                    );
                }
            );
        },
        function (message) {
            if (!isCurrent()) return;
            rg28SetStatus(
                message || "Source dependency identity resolution failed.",
                "warning"
            );
        }
    );
}


// ============================================================
// BUILD TARGET DEPENDENCY RESULT
// ============================================================

function rg282BuildDependencyComparison(
    sourceSolution,
    requiredComponents,
    sourceData,
    targetSnapshot
) {
    const targetComponentMap = new Map();

    (targetSnapshot.components || []).forEach(component => {
        if (!component.objectId) return;
        targetComponentMap.set(
            `${component.componentType}:${String(component.objectId).toLowerCase()}`,
            component
        );
    });

    const semanticResult = targetSnapshot.semanticMatches || {
        matches: [],
        checkedIdentityKeys: [],
        safeMissingIdentityKeys: [],
        possibleMissingIdentityKeys: [],
        ambiguousIdentityKeys: []
    };

    const runtimeDiagnostics = new Map((semanticResult.diagnostics || []).map(item => [
        `${Number(item.sourceComponentType)}:${String(item.sourceObjectId || "").toLowerCase()}`, item.message
    ]));
    const semanticMap = new Map(
        (semanticResult.matches || []).map(item => [
            `${Number(item.sourceComponentType)}:${String(item.sourceObjectId || "").toLowerCase()}`,
            item
        ])
    );

    const checkedIdentityKeys = new Set(semanticResult.checkedIdentityKeys || []);
    const safeMissingIdentityKeys = new Set(semanticResult.safeMissingIdentityKeys || []);
    const possibleMissingIdentityKeys = new Set(semanticResult.possibleMissingIdentityKeys || []);
    const ambiguousIdentityKeys = new Set(semanticResult.ambiguousIdentityKeys || []);

    const sameSolution = [];
    const otherSolutions = [];
    const managedBase = [];
    const semanticMatches = [];
    const confirmedMissing = [];
    const needsVerification = [];

    const sourceUniqueName = String(sourceSolution.uniquename || "").toLowerCase();

    function classifyProvider(dependency, providers, matchType, targetObjectId) {
        const normalizedProviders = providers || [];
        const sameProvider = normalizedProviders.find(
            provider => String(provider.uniqueName || "").toLowerCase() === sourceUniqueName
        );

        const record = {
            ...dependency,
            matchType,
            targetObjectId: targetObjectId || null,
            providers: normalizedProviders,
            provider: null,
            verificationState: "verified"
        };

        if (matchType === "stableIdentity") {
            record.provider =
                sameProvider ||
                normalizedProviders.find(provider => provider.isManaged === false) ||
                normalizedProviders.find(provider => provider.isManaged === true) ||
                normalizedProviders[0] ||
                null;
            semanticMatches.push(record);
            return;
        }

        if (sameProvider) {
            sameSolution.push({ ...record, provider: sameProvider });
            return;
        }

        const unmanagedProvider = normalizedProviders.find(provider => provider.isManaged === false);
        if (unmanagedProvider) {
            otherSolutions.push({ ...record, provider: unmanagedProvider });
            return;
        }

        const managedProvider = normalizedProviders.find(provider => provider.isManaged === true);
        if (managedProvider) {
            managedBase.push({ ...record, provider: managedProvider });
            return;
        }

        otherSolutions.push({ ...record, provider: normalizedProviders[0] || null });
    }

    requiredComponents.forEach(dependency => {
        const sourceKey = `${dependency.componentType}:${String(dependency.objectId).toLowerCase()}`;
        const exactMatch = targetComponentMap.get(sourceKey);

        if (exactMatch) {
            classifyProvider(dependency, exactMatch.providers || [], "exactGuid", exactMatch.objectId);
            return;
        }

        const semanticMatch = semanticMap.get(sourceKey);
        if (semanticMatch) {
            classifyProvider(dependency, semanticMatch.providers || [], "stableIdentity", semanticMatch.objectId);
            return;
        }

        const identityKey = dependency.identityKey;

        // A missing result only becomes a blocker when the resolver explicitly
        // marked the stable identity as safe for a conclusive absence check.
        if (identityKey && safeMissingIdentityKeys.has(identityKey)) {
            confirmedMissing.push({
                ...dependency,
                matchType: "stableIdentity",
                targetObjectId: null,
                targetChecked: true,
                verificationState: "confirmedMissing"
            });
            return;
        }

        if (identityKey && possibleMissingIdentityKeys.has(identityKey)) {
            needsVerification.push({
                ...dependency,
                matchType: "stableIdentity",
                targetObjectId: null,
                targetChecked: true,
                verificationState: "possibleMissing",
                verificationReason: "Target lookup completed, but this component identity is not strong enough to classify absence as a confirmed blocker."
            });
            return;
        }

        if (identityKey && ambiguousIdentityKeys.has(identityKey)) {
            needsVerification.push({
                ...dependency,
                matchType: "stableIdentity",
                targetObjectId: null,
                targetChecked: true,
                verificationState: "ambiguous",
                verificationReason: "Multiple target components matched this stable identity. Parent or component context must be reviewed."
            });
            return;
        }

        if (identityKey && checkedIdentityKeys.has(identityKey)) {
            needsVerification.push({
                ...dependency,
                targetChecked: true,
                verificationState: "unresolved",
                verificationReason: runtimeDiagnostics.get(sourceKey) || "The target check completed but did not produce a conclusive unique match."
            });
            return;
        }

        needsVerification.push({
            ...dependency,
            targetChecked: false,
            verificationState: "unresolved",
            verificationReason: runtimeDiagnostics.get(sourceKey) || dependency.identityResolution?.message || (dependency.identityKey
                ? "Release Guardian could not complete a conclusive target lookup for this identity."
                : "Release Guardian could not resolve a stable identity for this Dataverse component.")
        });
    });

    const configWarnings = rg282BuildConfigurationWarnings(sourceData, targetSnapshot);

    let verdict = "READY";
    if (confirmedMissing.length) verdict = "BLOCKED";
    else if (needsVerification.length || configWarnings.length) verdict = "WARNING";

    return {
        verdict,
        total: requiredComponents.length,
        sameSolution,
        otherSolutions,
        managedBase,
        semanticMatches,
        confirmedMissing,
        needsVerification,
        configWarnings
    };
}


// ============================================================
// ENVIRONMENT VARIABLE WARNINGS
// ============================================================

function rg282BuildConfigurationWarnings(
    sourceData,
    targetSnapshot
) {

    const warnings =
        [];


    const targetMap =
        new Map(
            (
                targetSnapshot.environmentVariables ||
                []
            )
                .map(
                    variable => [

                        String(
                            variable.schemaname ||
                            ""
                        )
                            .toLowerCase(),

                        variable
                    ]
                )
        );


    (
        sourceData.environmentVariables ||
        []
    )
        .forEach(
            function (sourceVariable) {

                const target =
                    targetMap.get(
                        String(
                            sourceVariable.schemaname ||
                            ""
                        )
                            .toLowerCase()
                    );


                if (
                    target &&
                    sourceVariable.isrequired &&
                    !target.hasCurrentValue
                ) {

                    warnings.push({

                        type:
                            "Environment Variable",

                        name:
                            sourceVariable.displayname ||
                            sourceVariable.schemaname,

                        message:
                            "Required environment variable has no current target value."
                    });
                }
            }
        );


    return warnings;
}


// ============================================================
// RENDER TARGET DEPENDENCY COVERAGE
// ============================================================

function rg282RenderDependencyComparison(
    comparison
) {

    const container =
        document.getElementById(
            "rg28ComparisonResults"
        );

    if (!container) {
        return;
    }

    container.style.display =
        "block";

    const selectedTargetSolution = comparison.sameSolution?.length || 0;
    const otherTargetSolutions = comparison.otherSolutions?.length || 0;
    const managedBase = comparison.managedBase?.length || 0;
    const stableIdentity = comparison.semanticMatches?.length || 0;
    const confirmedMissing = comparison.confirmedMissing?.length || 0;
    const needsVerification = comparison.needsVerification?.length || 0;
    const configWarnings = comparison.configWarnings?.length || 0;

    const satisfied =
        selectedTargetSolution +
        otherTargetSolutions +
        managedBase +
        stableIdentity;

    const coverage = comparison.total > 0
        ? Math.max(
            0,
            Math.min(
                100,
                Math.round(((comparison.total - needsVerification) / comparison.total) * 100)
            )
        )
        : 100;

    const title = confirmedMissing
        ? `${confirmedMissing} prerequisite${confirmedMissing === 1 ? " is" : "s are"} missing in the target`
        : needsVerification ? `${needsVerification} prerequisite${needsVerification === 1 ? " needs" : "s need"} manual review`
        : configWarnings ? "Configuration needs review" : "No blocking prerequisites detected";
    const explanation = confirmedMissing
        ? "Provide the missing prerequisites in the target, then run the check again."
        : needsVerification ? "No prerequisites were confirmed missing. Review the unverified checks below before deployment."
        : configWarnings ? "Prerequisites were verified. Review the configuration items below before deployment."
        : "The checks found no confirmed missing prerequisites or unresolved findings. This does not guarantee that an import will succeed.";
    container.innerHTML = `
        <div class="rg282-result-card rg282-dependency-card rg282-readiness-focus">
            <div class="rg282-result-title">
                <div><h3>${rgEscapeHtml(title)}</h3>
                    <p class="rg282-section-explainer">${rgEscapeHtml(explanation)}</p></div>
                <span class="rg28-verdict ${comparison.verdict === "READY" ? "rg28-ready" : comparison.verdict === "BLOCKED" ? "rg28-blocked" : "rg28-warning"}">${comparison.verdict === "WARNING" ? "REVIEW" : comparison.verdict}</span>
            </div>
            <div class="rg-flow-finding-counts">
                ${rg28Metric("Verified", satisfied, "success")}
                ${rg28Metric("Not verified", needsVerification, needsVerification ? "warning" : "")}
                ${rg28Metric("Confirmed missing", confirmedMissing, confirmedMissing ? "danger" : "")}
            </div>
            ${configWarnings ? `<p class="rg-flow-config-count">${configWarnings} configuration item${configWarnings === 1 ? " also needs" : "s also need"} review.</p>` : ""}
            <section id="rgFlowFindingsSlot" aria-label="Prerequisite findings"></section>
            <div id="rg282ConfigWarnings"></div>
            <details class="rg282-analysis-details">
                <summary>Technical check details</summary>
                <div class="rg282-score-ring"><span>Conclusive check coverage</span><strong>${coverage}%</strong></div>
                <p class="rg282-section-explainer rg282-coverage-note">Coverage includes both verified and confirmed-missing prerequisites. It is not a deployment score.</p>
                <div class="rg28-result-grid rg282-detail-metrics">
                    ${rg28Metric("Prerequisites checked", comparison.total)}
                    ${rg28Metric("Stable identity matches", stableIdentity)}
                    ${rg28Metric("In selected target solution", selectedTargetSolution)}
                    ${rg28Metric("In other target solutions", otherTargetSolutions)}
                    ${rg28Metric("Managed / base", managedBase)}
                </div>
                <div id="rg282ProviderSolutions"></div>
            </details>
            <div id="rg282ConfirmedMissing" hidden></div>
            <div id="rg282NeedsVerification" hidden></div>
        </div>
    `;
    rg282RenderProviders(comparison.otherSolutions || []);
    rg282RenderConfigWarnings(comparison.configWarnings || []);
    rgDependencyFilter = confirmedMissing ? "blocking" : needsVerification ? "external" : "managed";
    rgRenderReadinessDependencies.visibleCount = 25;
    if (typeof rgWorkflow !== "undefined") rgWorkflow.placeFindings(comparison);
    rgRenderReadinessDependencies();
}


function rg28Metric(
    label,
    value,
    tone = ""
) {

    return `

        <div class="rg28-result-metric ${tone
            ? `rg28-metric-${tone}`
            : ""
        }">

            <span>
                ${rgEscapeHtml(
            label
        )}
            </span>

            <strong>
                ${value}
            </strong>

        </div>
    `;
}


// ============================================================
// PROVIDER SOLUTIONS
// ============================================================

function rg282RenderProviders(
    dependencies
) {

    const container =
        document.getElementById(
            "rg282ProviderSolutions"
        );


    if (
        !container ||
        !dependencies.length
    ) {

        return;
    }


    const providers =
        new Map();


    dependencies.forEach(
        function (dependency) {

            const name =
                dependency.provider?.friendlyName ||
                dependency.provider?.uniqueName ||
                "Other Target Solution";


            if (
                !providers.has(
                    name
                )
            ) {

                providers.set(
                    name,
                    {
                        count:
                            0,

                        version:
                            dependency.provider?.version ||
                            null,

                        managed:
                            dependency.provider?.isManaged ===
                            true
                    }
                );
            }


            providers.get(
                name
            ).count++;
        }
    );


    container.innerHTML = `

        <div class="rg282-subsection-title">

            <span>
                PROVIDED BY OTHER TARGET SOLUTIONS
            </span>

            <strong>
                ${dependencies.length}
            </strong>

        </div>


        <div class="rg282-provider-list">

            ${[
            ...providers.entries()
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    b[1].count -
                    a[1].count
            )
            .map(
                (
                    [
                        name,
                        provider
                    ]
                ) => `

                            <div class="rg282-provider-row">

                                <div>

                                    <strong>

                                        ${rgEscapeHtml(
                    name
                )}

                                    </strong>

                                    <span>

                                        ${provider.managed
                        ? "Managed"
                        : "Unmanaged"
                    }

                                        ${provider.version
                        ? ` • v${rgEscapeHtml(
                            provider.version
                        )}`
                        : ""
                    }

                                    </span>

                                </div>


                                <b>
                                    ${provider.count}
                                </b>

                            </div>
                        `
            )
            .join(
                ""
            )
        }

        </div>
    `;
}


// ============================================================
// CONFIRMED MISSING DEPENDENCIES
// ============================================================

function rg282RenderConfirmedMissing(
    dependencies
) {

    const container = document.getElementById("rg282ConfirmedMissing");
    if (!container || !dependencies.length) return;

    container.innerHTML = `
        <div class="rg282-subsection-title">
            <span>CONFIRMED MISSING</span>
            <strong>${dependencies.length}</strong>
        </div>

        <div class="rg282-human-list">
            ${dependencies.slice(0, 30).map(dependency =>
        rg282HumanDependencyCard(dependency, "missing")
    ).join("")}
        </div>
    `;
}


// ============================================================
// NEEDS IDENTITY VERIFICATION
// ============================================================

function rg282RenderNeedsVerification(
    dependencies
) {
    const container = document.getElementById("rg282NeedsVerification");
    if (!container || !dependencies.length) return;

    container.innerHTML = `
        <div class="rg282-subsection-title">
            <span>NEEDS VERIFICATION</span>
            <strong>${dependencies.length}</strong>
        </div>

        <div class="rg282-verification-message">
            Release Guardian could not verify these prerequisites with enough confidence.
            They are <strong>not considered missing</strong> unless a stable identity check is conclusive.
        </div>

        <div class="rg282-human-list">
            ${dependencies.slice(0, 30).map(dependency =>
        rg282HumanDependencyCard(dependency, "verification")
    ).join("")}
        </div>
    `;
}

function rg282DependencyIdentityLabel(dependency) {
    const identity = dependency?.identity || {};
    const componentTypeName = RG_COMPONENT_TYPES[dependency?.componentType] || null;
    const guidPattern = /^[{]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[}]?$/i;
    const genericPattern = /^(?:Component|Type)\s+\d+$/i;

    const candidates = [
        identity.displayName,
        identity.name,
        identity.logicalName,
        identity.schemaName,
        identity.typeName,
        identity.componentTypeLabel,
        dependency?.identityResolution?.componentTypeLabel,
        componentTypeName
    ];

    const useful = candidates.find(value => {
        const text = String(value || "").trim();
        return text && !guidPattern.test(text) && !genericPattern.test(text);
    });

    return useful || "Unknown Dependency";
}

function rg282RequiredByLabel(dependency) {
    const identity = dependency?.requiredBy?.identity || {};
    return identity.displayName ||
        identity.name ||
        identity.logicalName ||
        identity.schemaName ||
        identity.typeName ||
        null;
}

function rg282DependencyParentLabel(dependency) {
    const identity = dependency?.identity || {};
    if (identity.tableDisplayName) return identity.tableDisplayName;
    if (identity.tableLogicalName) return identity.tableLogicalName;
    if (identity.tableSchemaName) return identity.tableSchemaName;
    return null;
}

function rg282HumanDependencyCard(dependency, status) {
    let componentName = rg282DependencyIdentityLabel(dependency);
    const requiredBy = rg282RequiredByLabel(dependency);
    if (componentName === "Unknown Dependency") componentName = requiredBy
        ? `Prerequisite for ${requiredBy}` : `Unidentified prerequisite · Type ${dependency?.componentType ?? "unknown"}`;
    const knownType = RG_COMPONENT_TYPES[dependency?.componentType] || dependency?.identity?.componentTypeLabel || dependency?.identityResolution?.componentTypeLabel || null;
    const sourceId = dependency?.objectId || null;
    const resolvedSourceId = dependency?.resolvedObjectId || null;
    const targetId = dependency?.targetObjectId || null;
    const provider = dependency?.provider?.friendlyName || dependency?.provider?.uniqueName || null;
    const identityConfidence = dependency?.identity?.confidence || null;

    const possibleMissing =
        status === "verification" &&
        dependency?.verificationState === "possibleMissing";

    const ambiguous =
        status === "verification" &&
        dependency?.verificationState === "ambiguous";

    const matchMethod = dependency?.matchType === "stableIdentity"
        ? status === "missing"
            ? "Stable identity checked — not found"
            : "Stable identity"
        : dependency?.matchType === "exactGuid"
            ? "Exact component ID"
            : dependency?.targetChecked
                ? "Target identity check completed"
                : "Unresolved";

    const statusLabel = status === "missing"
        ? "CONFIRMED MISSING"
        : status === "satisfied"
            ? "VERIFIED"
            : possibleMissing
                ? "POSSIBLE MISSING"
                : ambiguous
                    ? "AMBIGUOUS MATCH"
                    : "NOT VERIFIED";

    const explanation = status === "missing"
        ? "Release Guardian resolved a high-confidence stable identity, checked the target environment, and did not find this prerequisite. Deployment may fail until it is provided."
        : status === "satisfied"
            ? "This prerequisite was verified in the target environment."
            : dependency?.verificationReason ||
            "Release Guardian could not confidently identify this prerequisite in the target environment.";

    return `
        <article class="rg282-human-dependency rg282-human-${rgEscapeHtml(status)}">
            <details class="rg-flow-finding">
                <summary><span><strong>${rgEscapeHtml(componentName)}</strong>
                    <small>${knownType ? rgEscapeHtml(knownType) : componentName.startsWith("Prerequisite for ") ? rgEscapeHtml(`Dataverse type ${dependency?.componentType ?? "unknown"}`) : ""}${requiredBy && !componentName.startsWith("Prerequisite for ") ? ` · Needed by ${rgEscapeHtml(requiredBy)}` : ""}</small></span>
                    <span class="rg282-human-status">${rgEscapeHtml(statusLabel)}</span></summary>
                <div class="rg-flow-finding-body">
                    <p>${rgEscapeHtml(explanation)}</p>
                    ${status === "verification" ? '<p class="rg-flow-next-action">Confirm this prerequisite with the solution owner before deployment. An unresolved identity is not proof that it is missing.</p>' : ""}

            <details class="rg282-technical-details">
                <summary>Technical details</summary>
                <dl>
                    <div><dt>Component Type</dt><dd>${rgEscapeHtml(String(dependency?.componentType ?? "Unknown"))}</dd></div>
                    ${identityConfidence ? `<div><dt>Identity Confidence</dt><dd>${rgEscapeHtml(String(identityConfidence))}</dd></div>` : ""}
                    ${dependency?.identity?.kind === "runtimeRecord" ? `<div><dt>Runtime component registration</dt><dd>${dependency.identity.componentMappingVerified ? "Verified" : "Not verified"}</dd></div>
                    <div><dt>Active unique key fields</dt><dd>${rgEscapeHtml((dependency.identity.alternateKey || []).map(field => field.name).join(", ") || "None available; matching names alone are insufficient")}</dd></div>` : ""}
                    <div><dt>Match Method</dt><dd>${rgEscapeHtml(matchMethod)}</dd></div>
                    ${dependency?.identity?.tableLogicalName ? `<div><dt>${dependency.identity.kind === "runtimeRecord" ? "Component Table" : "Parent Table"}</dt><dd><code>${rgEscapeHtml(dependency.identity.tableLogicalName)}</code></dd></div>` : ""}
                    ${dependency?.identity?.logicalName ? `<div><dt>Logical Name</dt><dd><code>${rgEscapeHtml(dependency.identity.logicalName)}</code></dd></div>` : ""}
                    ${dependency?.identity?.schemaName ? `<div><dt>Schema Name</dt><dd><code>${rgEscapeHtml(dependency.identity.schemaName)}</code></dd></div>` : ""}
                    ${provider ? `<div><dt>Provider Solution</dt><dd>${rgEscapeHtml(provider)}</dd></div>` : ""}
                    ${sourceId ? `<div><dt>Dependency Source ID</dt><dd><code>${rgEscapeHtml(sourceId)}</code></dd></div>` : ""}
                    ${resolvedSourceId && String(resolvedSourceId).toLowerCase() !== String(sourceId || "").toLowerCase() ? `<div><dt>Resolved Component ID</dt><dd><code>${rgEscapeHtml(resolvedSourceId)}</code></dd></div>` : ""}
                    ${targetId ? `<div><dt>Target Component ID</dt><dd><code>${rgEscapeHtml(targetId)}</code></dd></div>` : ""}
                    ${dependency?.requiredBy?.objectId ? `<div><dt>Required By ID</dt><dd><code>${rgEscapeHtml(dependency.requiredBy.objectId)}</code></dd></div>` : ""}
                </dl>
            </details>
                </div>
            </details>
        </article>
    `;
}


// ============================================================
// CONFIGURATION WARNINGS
// ============================================================

function rg282RenderConfigWarnings(
    warnings
) {

    const container =
        document.getElementById(
            "rg282ConfigWarnings"
        );


    if (
        !container ||
        !warnings.length
    ) {

        return;
    }


    container.innerHTML = `

        <div class="rg282-subsection-title">

            <span>
                CONFIGURATION WARNINGS
            </span>

            <strong>
                ${warnings.length}
            </strong>

        </div>


        <div class="rg282-provider-list">

            ${warnings
            .map(
                warning => `

                            <div class="rg282-provider-row">

                                <div>

                                    <strong>

                                        ${rgEscapeHtml(
                    warning.name
                )}

                                    </strong>

                                    <span>

                                        ${rgEscapeHtml(
                    warning.message
                )}

                                    </span>

                                </div>

                            </div>
                        `
            )
            .join(
                ""
            )
        }

        </div>
    `;
}


// ============================================================
// TARGET STATUS
// ============================================================

function rg28SetStatus(
    message,
    tone = "default"
) {
    if (typeof rgWorkflow !== "undefined") rgWorkflow.targetStatus(message, tone);


    const element =
        document.getElementById(
            "rg28TargetStatus"
        );


    if (!element) {

        return;
    }


    element.textContent =
        message;


    element.className =
        `rg28-status-box rg28-status-${tone}`;
}
// ============================================================
// PREMIUM VISUAL LAYOUT
// UI-only enhancement. Does not change Dataverse logic.
// ============================================================

function rgApplyPremiumVisualLayout() {
    if (typeof rgWorkflow !== "undefined" && rgWorkflow.initialized) return;

    rgDecorateHomeCards();

    rgDecorateSolutionScreen();

    rgDecorateExplorerCards();

    rgDecorateReadinessScreen();
}


// ============================================================
// HOME
// ============================================================

function rgDecorateHomeCards() {

    const environmentCard =
        document
            .getElementById(
                "environmentHost"
            )
            ?.closest(
                ".card"
            );


    const connectionCard =
        document
            .getElementById(
                "whoAmIButton"
            )
            ?.closest(
                ".card"
            );


    const solutionsCard =
        document
            .getElementById(
                "loadSolutionsButton"
            )
            ?.closest(
                ".card"
            );


    rgDecorateHomeCard(
        environmentCard,
        "environment",
        "Environment",
        "Current Dataverse context",
        `
            <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="13" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
            </svg>
        `
    );


    rgDecorateHomeCard(
        connectionCard,
        "connection",
        "Dataverse Connection",
        "Authenticated browser session",
        `
            <svg viewBox="0 0 24 24">
                <path d="M8 12.5 10.5 15 16 9.5"/>
                <circle cx="12" cy="12" r="9"/>
            </svg>
        `
    );


    rgDecorateHomeCard(
        solutionsCard,
        "solutions",
        "Solutions",
        "Choose a deployment package",
        `
            <svg viewBox="0 0 24 24">
                <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/>
                <path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>
            </svg>
        `
    );
}


function rgDecorateHomeCard(
    card,
    type,
    title,
    subtitle,
    icon
) {

    if (
        !card
    ) {

        return;
    }


    card.classList.add(
        "rg-premium-home-card",
        `rg-premium-${type}`
    );


    if (
        card.querySelector(
            ".rg-premium-card-heading"
        )
    ) {

        return;
    }


    const oldHeading =
        card.querySelector(
            "h2, h3"
        );


    if (
        oldHeading
    ) {

        oldHeading.style.display =
            "none";
    }


    const heading =
        document.createElement(
            "div"
        );


    heading.className =
        "rg-premium-card-heading";


    heading.innerHTML = `

        <div class="rg-premium-card-icon">
            ${icon}
        </div>

        <div class="rg-premium-card-title">

            <strong>
                ${rgEscapeHtml(
        title
    )}
            </strong>

            <span>
                ${rgEscapeHtml(
        subtitle
    )}
            </span>

        </div>
    `;


    card.prepend(
        heading
    );
}


// ============================================================
// SOLUTION SCREEN
// ============================================================

function rgDecorateSolutionScreen() {

    const analysis =
        document.getElementById(
            "analysisCard"
        );


    if (
        !analysis
    ) {

        return;
    }


    analysis.classList.add(
        "rg-premium-analysis"
    );


    const summaryBoxes =
        analysis.querySelectorAll(
            ".summary-box, .summary-button"
        );


    const componentStyles = [

        {
            icon: "Σ",
            className: "rg-summary-total"
        },

        {
            icon: "▦",
            className: "rg-summary-table"
        },

        {
            icon: "⌗",
            className: "rg-summary-column"
        },

        {
            icon: "▤",
            className: "rg-summary-form"
        },

        {
            icon: "☷",
            className: "rg-summary-view"
        },

        {
            icon: "⌁",
            className: "rg-summary-process"
        },

        {
            icon: "</>",
            className: "rg-summary-web"
        },

        {
            icon: "◇",
            className: "rg-summary-choice"
        },

        {
            icon: "+",
            className: "rg-summary-other"
        }
    ];


    summaryBoxes.forEach(
        function (
            card,
            index
        ) {

            const config =
                componentStyles[
                index
                ];


            if (
                !config
            ) {

                return;
            }


            card.classList.add(
                "rg-premium-summary",
                config.className
            );


            if (
                card.querySelector(
                    ".rg-summary-icon"
                )
            ) {

                return;
            }


            const icon =
                document.createElement(
                    "div"
                );


            icon.className =
                "rg-summary-icon";


            icon.textContent =
                config.icon;


            card.prepend(
                icon
            );
        }
    );
}


// ============================================================
// EXPLORER
// ============================================================

function rgDecorateExplorerCards() {

    const cards =
        document.querySelectorAll(
            ".rg27-explorer-card"
        );


    cards.forEach(
        function (
            card
        ) {

            if (
                card.dataset.premium ===
                "true"
            ) {

                return;
            }


            const titleElement =
                card.querySelector(
                    "span"
                );


            const title =
                String(
                    titleElement?.textContent ||
                    ""
                )
                    .trim()
                    .toLowerCase();


            const config =
                rgGetExplorerCardStyle(
                    title
                );


            card.dataset.premium =
                "true";


            card.classList.add(
                "rg-premium-explorer-card",
                config.className
            );


            const icon =
                document.createElement(
                    "div"
                );


            icon.className =
                "rg-explorer-icon";


            icon.innerHTML =
                config.icon;


            card.prepend(
                icon
            );
        }
    );
}


function rgGetExplorerCardStyle(
    title
) {

    if (
        title.includes(
            "table"
        )
    ) {

        return {

            className:
                "rg-explorer-blue",

            icon: `
                <svg viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                    <path d="M3 9h18M9 9v11M15 9v11"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "form"
        )
    ) {

        return {

            className:
                "rg-explorer-purple",

            icon: `
                <svg viewBox="0 0 24 24">
                    <rect x="4" y="3" width="16" height="18" rx="2"/>
                    <path d="M8 8h8M8 12h8M8 16h5"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "view"
        )
    ) {

        return {

            className:
                "rg-explorer-cyan",

            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
                    <circle cx="12" cy="12" r="2.5"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "process"
        )
    ) {

        return {

            className:
                "rg-explorer-violet",

            icon: `
                <svg viewBox="0 0 24 24">
                    <circle cx="6" cy="6" r="2"/>
                    <circle cx="18" cy="6" r="2"/>
                    <circle cx="12" cy="18" r="2"/>
                    <path d="M8 6h8M7 8l4 8M17 8l-4 8"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "web resource"
        )
    ) {

        return {

            className:
                "rg-explorer-green",

            icon: `
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9Z"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "choice"
        )
    ) {

        return {

            className:
                "rg-explorer-indigo",

            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="m12 3 8 4-8 4-8-4Z"/>
                    <path d="m4 12 8 4 8-4M4 17l8 4 8-4"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "environment"
        )
    ) {

        return {

            className:
                "rg-explorer-emerald",

            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
                    <circle cx="12" cy="12" r="5"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "connection"
        )
    ) {

        return {

            className:
                "rg-explorer-orange",

            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="M9 7H6a4 4 0 0 0 0 8h3"/>
                    <path d="M15 7h3a4 4 0 1 1 0 8h-3"/>
                    <path d="M8 12h8"/>
                </svg>
            `
        };
    }


    if (
        title.includes(
            "assembly"
        )
    ) {

        return {

            className:
                "rg-explorer-pink",

            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/>
                    <path d="M8 12h8"/>
                </svg>
            `
        };
    }


    return {

        className:
            "rg-explorer-slate",

        icon: `
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>
            </svg>
        `
    };
}


// ============================================================
// READINESS
// ============================================================

function rgDecorateReadinessScreen() {

    document
        .getElementById(
            "rg28TargetPanel"
        )
        ?.classList.add(
            "rg-premium-preflight"
        );


    document
        .getElementById(
            "rgReadinessPanel"
        )
        ?.classList.add(
            "rg-premium-readiness"
        );
}


// ============================================================
// KEEP DYNAMIC CONTENT DECORATED
// ============================================================

let rgPremiumObserver =
    null;


function rgInstallPremiumObserver() {

    if (
        rgPremiumObserver
    ) {

        return;
    }


    rgPremiumObserver =
        new MutationObserver(
            function () {

                window.requestAnimationFrame(
                    rgApplyPremiumVisualLayout
                );
            }
        );


    rgPremiumObserver.observe(
        document.body,
        {
            childList:
                true,

            subtree:
                true
        }
    );
}


// ============================================================
// INITIALIZE
// ============================================================

window.setTimeout(
    function () {

        rgApplyPremiumVisualLayout();

        rgInstallPremiumObserver();

    },
    700
);
// ============================================================
// SOLUTION PAGE PREMIUM CONTROLS
// UI only — no Dataverse logic changes
// ============================================================

function rgDecorateDeploymentComponents() {

    const section =
        document.getElementById(
            "rg25PlatformComponents"
        );

    if (!section) {
        return;
    }


    section.classList.add(
        "rg-premium-deployment-components"
    );


    const configs = {

        environment: {
            label: "Environment Variables",
            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="M4 12h16"/>
                    <path d="M12 4v16"/>
                    <circle cx="12" cy="12" r="8"/>
                </svg>
            `
        },

        connections: {
            label: "Connection References",
            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="M9 7H6a4 4 0 0 0 0 8h3"/>
                    <path d="M15 7h3a4 4 0 1 1 0 8h-3"/>
                    <path d="M8 12h8"/>
                </svg>
            `
        },

        assemblies: {
            label: "Plug-in Assemblies",
            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/>
                    <path d="m4 7.5 8 4.5 8-4.5"/>
                    <path d="M12 12v9"/>
                </svg>
            `
        },

        steps: {
            label: "Plug-in Steps",
            icon: `
                <svg viewBox="0 0 24 24">
                    <path d="m8 5 11 7-11 7Z"/>
                </svg>
            `
        }
    };


    Object.entries(
        configs
    )
        .forEach(
            function ([action, config]) {

                const button =
                    section.querySelector(
                        `[data-action="${action}"]`
                    );


                if (
                    !button ||
                    button.dataset.rgPremium === "true"
                ) {
                    return;
                }


                button.dataset.rgPremium =
                    "true";


                button.innerHTML = `

                    <span class="rg-deployment-button-icon">
                        ${config.icon}
                    </span>

                    <span class="rg-deployment-button-label">
                        ${rgEscapeHtml(config.label)}
                    </span>
                `;
            }
        );
}


function rgUpgradeSolutionReadinessShortcut() {

    const shortcut =
        document.getElementById(
            "rgReadinessShortcut"
        );


    if (
        !shortcut ||
        shortcut.dataset.rgPremium === "true"
    ) {
        return;
    }


    shortcut.dataset.rgPremium =
        "true";


    const existingContent =
        shortcut.innerHTML;


    shortcut.innerHTML = `

        <div class="rg-solution-readiness-icon">

            <svg viewBox="0 0 24 24">

                <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z"/>

                <path d="m8.5 12 2.2 2.2 4.8-5"/>

            </svg>

        </div>


        <div class="rg-solution-readiness-content">

            ${existingContent}

        </div>


        <div class="rg-solution-readiness-chevron">
            ›
        </div>
    `;
}


function rgApplySolutionPagePremiumUI() {
    if (typeof rgWorkflow !== "undefined" && rgWorkflow.initialized) return;

    rgDecorateDeploymentComponents();

    rgUpgradeSolutionReadinessShortcut();
}


window.setTimeout(
    rgApplySolutionPagePremiumUI,
    800
);


if (typeof rgPremiumObserver !== "undefined") {

    window.setTimeout(
        rgApplySolutionPagePremiumUI,
        1000
    );
}
