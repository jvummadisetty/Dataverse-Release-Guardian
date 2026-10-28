// ============================================================
// DATAVERSE RELEASE GUARDIAN
// CONTENT SCRIPT
// Same-origin Dataverse Web API bridge for the side panel
// ============================================================

console.log(
    "Dataverse Release Guardian content script loaded."
);


// ============================================================
// DATAVERSE FETCH
// ============================================================

async function dataverseFetch(
    url
) {

    const response =
        await fetch(
            url,
            {
                method:
                    "GET",

                credentials:
                    "include",

                headers: {

                    "Accept":
                        "application/json",

                    "OData-MaxVersion":
                        "4.0",

                    "OData-Version":
                        "4.0",

                    "Prefer":
                        "odata.maxpagesize=5000"
                }
            }
        );


    const text =
        await response.text();


    if (
        !response.ok
    ) {

        const error =
            new Error(
                text ||
                `HTTP ${response.status}`
            );


        error.status =
            response.status;


        throw error;
    }


    return text
        ? JSON.parse(
            text
        )
        : {};
}


// ============================================================
// FETCH ALL ODATA PAGES
// ============================================================

async function fetchAllPages(
    initialUrl
) {

    let nextUrl =
        initialUrl;


    const records =
        [];


    while (
        nextUrl
    ) {

        const data =
            await dataverseFetch(
                nextUrl
            );


        if (
            Array.isArray(
                data.value
            )
        ) {

            records.push(
                ...data.value
            );
        }


        nextUrl =
            data["@odata.nextLink"] ||
            null;
    }


    return records;
}


// ============================================================
// HELPERS
// ============================================================

function escapeODataString(
    value
) {

    return String(
        value ||
        ""
    )
        .replace(
            /'/g,
            "''"
        );
}


function cleanGuid(
    value
) {

    return String(
        value ||
        ""
    )
        .replace(
            /[{}]/g,
            ""
        )
        .trim();
}


function normalizeGuid(
    value
) {

    return cleanGuid(
        value
    )
        .toLowerCase();
}


function normalizeError(
    error
) {

    return {

        success:
            false,

        status:
            error?.status ||
            0,

        error:
            error?.message ||
            String(
                error
            )
    };
}


// ============================================================
// WHO AM I
// ============================================================

async function whoAmI() {

    try {

        const data =
            await dataverseFetch(

                `${window.location.origin}` +
                "/api/data/v9.2/WhoAmI"
            );


        return {

            success:
                true,

            data
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// SOLUTIONS
// ============================================================

async function getSolutions() {

    try {

        const query =
            "/api/data/v9.2/solutions" +
            "?$select=" +
            "solutionid," +
            "uniquename," +
            "friendlyname," +
            "version," +
            "ismanaged" +
            "&$filter=isvisible eq true" +
            "&$orderby=friendlyname asc";


        const solutions =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        return {

            success:
                true,

            solutions
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// SOLUTION COMPONENT NORMALIZATION
//
// Dataverse can return more than one solutioncomponent row for the
// same underlying component (for example through root/subcomponent
// relationships). Power Apps presents the underlying component once.
// Normalize by component type + object ID so Release Guardian counts
// the package the same way a maker sees it in the solution UI.
// ============================================================

function normalizeSolutionComponentsForInventory(components) {

    const map = new Map();

    (components || []).forEach(component => {

        const type = Number(component?.componenttype);
        const objectId = normalizeGuid(component?.objectid);
        const solutionComponentId = normalizeGuid(component?.solutioncomponentid);

        // objectid is the identity of the underlying solution component.
        // Fall back to the row ID only for uncommon rows that have no objectid.
        const key = objectId
            ? `${type}:${objectId}`
            : `${type}:row:${solutionComponentId}`;

        const existing = map.get(key);

        if (!existing) {
            map.set(key, { ...component });
            return;
        }

        // Preserve the strongest table-root behavior. If any duplicate row
        // includes subcomponents, the normalized component must retain that.
        if (Number(component?.rootcomponentbehavior) === 0) {
            existing.rootcomponentbehavior = 0;
        }
        else if (existing.rootcomponentbehavior === null ||
            existing.rootcomponentbehavior === undefined) {
            existing.rootcomponentbehavior = component?.rootcomponentbehavior;
        }

        // Retain a root solution component id when one of the rows has it.
        if (!existing.rootsolutioncomponentid && component?.rootsolutioncomponentid) {
            existing.rootsolutioncomponentid = component.rootsolutioncomponentid;
        }
    });

    return Array.from(map.values());
}


// ============================================================
// SOLUTION COMPONENTS
// ============================================================

async function getSolutionComponents(
    solutionId
) {

    try {

        if (
            !solutionId
        ) {

            return {

                success:
                    false,

                status:
                    0,

                error:
                    "Solution ID is required."
            };
        }


        const cleanId =
            cleanGuid(
                solutionId
            );


        const query =
            "/api/data/v9.2/solutioncomponents" +
            "?$select=" +
            "solutioncomponentid," +
            "objectid," +
            "componenttype," +
            "rootcomponentbehavior," +
            "rootsolutioncomponentid" +
            `&$filter=_solutionid_value eq ${cleanId}`;


        const components =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        const normalizedComponents =
            normalizeSolutionComponentsForInventory(
                components
            );


        return {

            success:
                true,

            components:
                normalizedComponents,

            rawComponentCount:
                components.length,

            normalizedComponentCount:
                normalizedComponents.length,

            duplicateRowsCollapsed:
                Math.max(
                    0,
                    components.length - normalizedComponents.length
                )
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// MISSING SOLUTION DEPENDENCIES
// ============================================================

async function getMissingDependencies(
    solutionUniqueName
) {

    try {

        if (
            !solutionUniqueName
        ) {

            return {

                success:
                    false,

                status:
                    0,

                error:
                    "Solution unique name is required."
            };
        }


        const escapedName =
            escapeODataString(
                solutionUniqueName
            );


        const url =
            `${window.location.origin}` +
            "/api/data/v9.2/" +
            "RetrieveMissingDependencies" +
            `(SolutionUniqueName='${escapedName}')`;


        const dependencies =
            await fetchAllPages(
                url
            );


        return {

            success:
                true,

            dependencies
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// SOLUTION DEPENDENCIES
//
// Accepts either:
// - solutionUniqueName
// - solutionId
//
// This keeps the side-panel API simple.
// ============================================================

async function getSolutionDependencies(
    request
) {

    try {

        let uniqueName =
            request?.solutionUniqueName ||
            null;


        if (
            !uniqueName &&
            request?.solutionId
        ) {

            const id =
                cleanGuid(
                    request.solutionId
                );


            const query =
                "/api/data/v9.2/solutions" +
                "?$select=uniquename" +
                `&$filter=solutionid eq ${id}`;


            const records =
                await fetchAllPages(

                    `${window.location.origin}${query}`
                );


            uniqueName =
                records[0]?.uniquename ||
                null;
        }


        if (
            !uniqueName
        ) {

            return {

                success:
                    false,

                status:
                    0,

                error:
                    "Solution unique name could not be resolved."
            };
        }


        return getMissingDependencies(
            uniqueName
        );
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// DEPENDENT COMPONENTS
//
// Components that depend ON the selected component.
// ============================================================

async function getDependentComponents(
    objectId,
    componentType
) {

    try {

        const id =
            cleanGuid(
                objectId
            );


        if (
            !id ||
            componentType ===
            undefined ||
            componentType ===
            null
        ) {

            return {

                success:
                    false,

                status:
                    0,

                error:
                    "Object ID and component type are required."
            };
        }


        const url =
            `${window.location.origin}` +
            "/api/data/v9.2/" +
            "RetrieveDependentComponents" +
            `(ObjectId=${id},ComponentType=${componentType})`;


        const dependencies =
            await fetchAllPages(
                url
            );


        return {

            success:
                true,

            dependencies
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// REQUIRED COMPONENTS
//
// Components required BY the selected component.
// ============================================================

async function getRequiredComponents(
    objectId,
    componentType
) {

    try {

        const id =
            cleanGuid(
                objectId
            );


        if (
            !id ||
            componentType ===
            undefined ||
            componentType ===
            null
        ) {

            return {

                success:
                    false,

                status:
                    0,

                error:
                    "Object ID and component type are required."
            };
        }


        const url =
            `${window.location.origin}` +
            "/api/data/v9.2/" +
            "RetrieveRequiredComponents" +
            `(ObjectId=${id},ComponentType=${componentType})`;


        const dependencies =
            await fetchAllPages(
                url
            );


        return {

            success:
                true,

            dependencies
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// COMPLETE COMPONENT DEPENDENCY BUNDLE
// ============================================================

async function getDependencyBundle(
    objectId,
    componentType
) {

    try {

        const results =
            await Promise.all([

                getDependentComponents(
                    objectId,
                    componentType
                ),

                getRequiredComponents(
                    objectId,
                    componentType
                )
            ]);


        return {

            success:
                true,

            dependents:

                results[0]?.success
                    ? results[0].dependencies
                    : [],

            required:

                results[1]?.success
                    ? results[1].dependencies
                    : [],

            dependentError:

                results[0]?.success
                    ? null
                    : results[0]?.error,

            requiredError:

                results[1]?.success
                    ? null
                    : results[1]?.error
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// TABLE METADATA
// ============================================================

async function getTableMetadata() {

    try {

        const query =
            "/api/data/v9.2/EntityDefinitions" +
            "?$select=" +
            "MetadataId," +
            "LogicalName," +
            "SchemaName," +
            "DisplayName";


        const tables =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        return {

            success:
                true,

            tables
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// TABLE COLUMNS
// ============================================================

async function getTableColumns(
    metadataId
) {

    const cleanId =
        cleanGuid(
            metadataId
        );


    const query =
        `/api/data/v9.2/EntityDefinitions(${cleanId})/Attributes` +
        "?$select=" +
        "MetadataId," +
        "LogicalName," +
        "SchemaName," +
        "DisplayName," +
        "AttributeType," +
        "IsCustomAttribute";


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// TABLE FORMS
// ============================================================

async function getTableForms(
    logicalName
) {

    const escapedLogicalName =
        escapeODataString(
            logicalName
        );


    const query =
        "/api/data/v9.2/systemforms" +
        "?$select=" +
        "formid," +
        "name," +
        "uniquename," +
        "type," +
        "objecttypecode," +
        "formxml," +
        "ismanaged," +
        "componentstate" +
        "&$filter=" +
        `objecttypecode eq '${escapedLogicalName}'`;


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// TABLE VIEWS
// ============================================================

async function getTableViews(
    logicalName
) {

    const escapedLogicalName =
        escapeODataString(
            logicalName
        );


    const query =
        "/api/data/v9.2/savedqueries" +
        "?$select=" +
        "savedqueryid," +
        "name," +
        "querytype," +
        "returnedtypecode," +
        "statecode," +
        "isdefault," +
        "isquickfindquery," +
        "fetchxml," +
        "layoutxml," +
        "columnsetxml," +
        "ismanaged," +
        "componentstate" +
        "&$filter=" +
        `returnedtypecode eq '${escapedLogicalName}'`;


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// 1:N RELATIONSHIPS
// ============================================================

async function getOneToManyRelationships(
    metadataId
) {

    const cleanId =
        cleanGuid(
            metadataId
        );


    const query =
        `/api/data/v9.2/EntityDefinitions(${cleanId})/OneToManyRelationships` +
        "?$select=" +
        "MetadataId," +
        "SchemaName," +
        "ReferencedEntity," +
        "ReferencingEntity," +
        "ReferencingAttribute," +
        "IsCustomRelationship";


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// N:1 RELATIONSHIPS
// ============================================================

async function getManyToOneRelationships(
    metadataId
) {

    const cleanId =
        cleanGuid(
            metadataId
        );


    const query =
        `/api/data/v9.2/EntityDefinitions(${cleanId})/ManyToOneRelationships` +
        "?$select=" +
        "MetadataId," +
        "SchemaName," +
        "ReferencedEntity," +
        "ReferencingEntity," +
        "ReferencingAttribute," +
        "IsCustomRelationship";


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// N:N RELATIONSHIPS
// ============================================================

async function getManyToManyRelationships(
    metadataId
) {

    const cleanId =
        cleanGuid(
            metadataId
        );


    const query =
        `/api/data/v9.2/EntityDefinitions(${cleanId})/ManyToManyRelationships` +
        "?$select=" +
        "MetadataId," +
        "SchemaName," +
        "Entity1LogicalName," +
        "Entity2LogicalName," +
        "IntersectEntityName," +
        "IsCustomRelationship";


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// TABLE PROCESSES
// ============================================================

async function getTableProcesses(
    logicalName
) {

    const escapedLogicalName =
        escapeODataString(
            logicalName
        );


    const query =
        "/api/data/v9.2/workflows" +
        "?$select=" +
        "workflowid," +
        "workflowidunique," +
        "name," +
        "uniquename," +
        "category," +
        "primaryentity," +
        "statecode," +
        "statuscode," +
        "mode," +
        "ondemand," +
        "modernflowtype," +
        "componentstate," +
        "ismanaged," +
        "modifiedon," +
        "clientdata," +
        "xaml," +
        "triggeronupdateattributelist," +
        "type" +
        "&$filter=" +
        `primaryentity eq '${escapedLogicalName}' and type eq 1`;


    return fetchAllPages(

        `${window.location.origin}${query}`
    );
}


// ============================================================
// COMPLETE TABLE DETAILS
// ============================================================

async function getTableDetails(
    metadataId,
    logicalName
) {

    try {

        if (
            !metadataId ||
            !logicalName
        ) {

            return {

                success:
                    false,

                status:
                    0,

                error:
                    "Table metadata ID and logical name are required."
            };
        }


        const results =
            await Promise.all([

                getTableColumns(
                    metadataId
                ),

                getTableForms(
                    logicalName
                ),

                getTableViews(
                    logicalName
                ),

                getOneToManyRelationships(
                    metadataId
                ),

                getManyToOneRelationships(
                    metadataId
                ),

                getManyToManyRelationships(
                    metadataId
                ),

                getTableProcesses(
                    logicalName
                )
            ]);


        return {

            success:
                true,

            columns:
                results[0],

            forms:
                results[1],

            views:
                results[2],

            oneToMany:
                results[3],

            manyToOne:
                results[4],

            manyToMany:
                results[5],

            processes:
                results[6]
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// SOLUTION EXPLORER HELPERS
// ============================================================

function buildSolutionFilter(
    solutionId
) {

    const id =
        cleanGuid(
            solutionId
        );


    return `solutionid eq ${id}`;
}


// ============================================================
// FETCH RECORDS BY IDS
// ============================================================

async function fetchRecordsByIds(
    entitySet,
    idField,
    ids,
    select,
    chunkSize = 20
) {

    const cleanIds =
        [
            ...new Set(

                (
                    ids ||
                    []
                )
                    .filter(Boolean)
                    .map(
                        id =>
                            cleanGuid(
                                id
                            )
                    )
            )
        ];


    if (
        !cleanIds.length
    ) {

        return [];
    }


    const records =
        [];


    for (
        let index = 0;
        index < cleanIds.length;
        index += chunkSize
    ) {

        const chunk =
            cleanIds.slice(
                index,
                index + chunkSize
            );


        const filter =
            chunk
                .map(
                    id =>
                        `${idField} eq ${id}`
                )
                .join(
                    " or "
                );


        const query =
            `/api/data/v9.2/${entitySet}` +
            `?$select=${select}` +
            `&$filter=${encodeURIComponent(filter)}`;


        const batch =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        records.push(
            ...batch
        );
    }


    return records;
}


// ============================================================
// FETCH BY MULTIPLE POSSIBLE ID FIELDS
//
// Useful for components where solutioncomponent.objectid may map
// to different Dataverse identifiers depending on component type.
// ============================================================

async function fetchRecordsByMultipleIdFields(
    entitySet,
    idFields,
    ids,
    select,
    chunkSize = 15
) {

    const cleanIds =
        [
            ...new Set(

                (
                    ids ||
                    []
                )
                    .filter(Boolean)
                    .map(
                        id =>
                            cleanGuid(
                                id
                            )
                    )
            )
        ];


    if (
        !cleanIds.length
    ) {

        return [];
    }


    const output =
        [];


    const seen =
        new Set();


    for (
        let index = 0;
        index < cleanIds.length;
        index += chunkSize
    ) {

        const chunk =
            cleanIds.slice(
                index,
                index + chunkSize
            );


        const filters =
            [];


        idFields.forEach(
            function (field) {

                chunk.forEach(
                    function (id) {

                        filters.push(
                            `${field} eq ${id}`
                        );
                    }
                );
            }
        );


        const query =
            `/api/data/v9.2/${entitySet}` +
            `?$select=${select}` +
            `&$filter=${encodeURIComponent(filters.join(" or "))}`;


        const records =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        records.forEach(
            function (record) {

                const key =
                    JSON.stringify(
                        record
                    );


                if (
                    seen.has(
                        key
                    )
                ) {

                    return;
                }


                seen.add(
                    key
                );


                output.push(
                    record
                );
            }
        );
    }


    return output;
}
// ============================================================
// SOLUTION WORKFLOWS / PROCESSES
// ============================================================

async function getSolutionWorkflows(
    componentIds
) {

    return fetchRecordsByMultipleIdFields(

        "workflows",

        [
            "workflowid",
            "workflowidunique"
        ],

        componentIds,

        [
            "workflowid",
            "workflowidunique",
            "name",
            "uniquename",
            "category",
            "primaryentity",
            "statecode",
            "statuscode",
            "mode",
            "ondemand",
            "modernflowtype",
            "componentstate",
            "ismanaged",
            "modifiedon",
            "type"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION WEB RESOURCES
// ============================================================

async function getSolutionWebResources(
    componentIds
) {

    return fetchRecordsByIds(

        "webresourceset",

        "webresourceid",

        componentIds,

        [
            "webresourceid",
            "name",
            "displayname",
            "description",
            "webresourcetype",
            "ismanaged",
            "componentstate",
            "modifiedon"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION FORMS
// ============================================================

async function getSolutionForms(
    componentIds
) {

    return fetchRecordsByIds(

        "systemforms",

        "formid",

        componentIds,

        [
            "formid",
            "name",
            "uniquename",
            "type",
            "objecttypecode",
            "ismanaged",
            "componentstate"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION VIEWS
// ============================================================

async function getSolutionViews(
    componentIds
) {

    return fetchRecordsByIds(

        "savedqueries",

        "savedqueryid",

        componentIds,

        [
            "savedqueryid",
            "name",
            "returnedtypecode",
            "querytype",
            "statecode",
            "isdefault",
            "isquickfindquery",
            "ismanaged",
            "componentstate"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION ENVIRONMENT VARIABLES
// ============================================================

async function getSolutionEnvironmentVariables(
    definitionComponentIds
) {

    const definitions =
        await fetchRecordsByIds(

            "environmentvariabledefinitions",

            "environmentvariabledefinitionid",

            definitionComponentIds,

            [
                "environmentvariabledefinitionid",
                "displayname",
                "schemaname",
                "description",
                "defaultvalue",
                "type",
                "isrequired",
                "ismanaged",
                "statecode",
                "componentstate",
                "secretstore"
            ]
                .join(",")
        );


    const definitionIds =
        definitions
            .map(
                item =>
                    item.environmentvariabledefinitionid
            )
            .filter(Boolean);


    const values =
        await fetchRecordsByIds(

            "environmentvariablevalues",

            "_environmentvariabledefinitionid_value",

            definitionIds,

            [
                "environmentvariablevalueid",
                "schemaname",
                "value",
                "statecode",
                "componentstate",
                "ismanaged",
                "_environmentvariabledefinitionid_value"
            ]
                .join(",")
        );


    const definitionMap =
        new Map(

            definitions.map(
                definition => [

                    normalizeGuid(
                        definition.environmentvariabledefinitionid
                    ),

                    definition
                ]
            )
        );


    const valuesByDefinition =
        new Map();


    values.forEach(
        function (value) {

            const definitionId =
                normalizeGuid(

                    value
                        ._environmentvariabledefinitionid_value
                );


            if (
                !definitionId
            ) {

                return;
            }


            if (
                !valuesByDefinition.has(
                    definitionId
                )
            ) {

                valuesByDefinition.set(
                    definitionId,
                    []
                );
            }


            const definition =
                definitionMap.get(
                    definitionId
                );


            const isSecret =
                definition?.type ===
                100000005;


            // Never expose secret environment-variable values
            // outside the content script.
            const safeValue = {

                ...value,

                value:
                    isSecret
                        ? (
                            value.value !==
                                null &&
                                value.value !==
                                undefined &&
                                String(
                                    value.value
                                ).trim() !==
                                ""

                                ? "[configured]"
                                : ""
                        )
                        : value.value
            };


            valuesByDefinition
                .get(
                    definitionId
                )
                .push(
                    safeValue
                );
        }
    );


    return definitions.map(
        function (definition) {

            const id =
                normalizeGuid(

                    definition
                        .environmentvariabledefinitionid
                );


            return {

                ...definition,

                currentValues:

                    valuesByDefinition.get(
                        id
                    ) ||
                    []
            };
        }
    );
}


// ============================================================
// SOLUTION CONNECTION REFERENCES
// ============================================================

async function getSolutionConnectionReferences(
    componentIds
) {

    return fetchRecordsByIds(

        "connectionreferences",

        "connectionreferenceid",

        componentIds,

        [
            "connectionreferenceid",
            "connectionreferencedisplayname",
            "connectionreferencelogicalname",
            "connectorid",
            "statecode",
            "ismanaged",
            "componentstate",
            "promptingbehavior"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION PLUG-IN ASSEMBLIES
// ============================================================

async function getSolutionPluginAssemblies(
    componentIds
) {

    return fetchRecordsByIds(

        "pluginassemblies",

        "pluginassemblyid",

        componentIds,

        [
            "pluginassemblyid",
            "name",
            "version",
            "publickeytoken",
            "isolationmode",
            "sourcetype",
            "ismanaged",
            "componentstate",
            "modifiedon"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION PLUG-IN TYPES
// ============================================================

async function getSolutionPluginTypes(
    componentIds
) {

    return fetchRecordsByIds(

        "plugintypes",

        "plugintypeid",

        componentIds,

        [
            "plugintypeid",
            "typename",
            "name",
            "friendlyname",
            "assemblyname",
            "ismanaged",
            "componentstate",
            "_pluginassemblyid_value"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION PLUG-IN STEPS
// ============================================================

async function getSolutionPluginSteps(
    componentIds
) {

    return fetchRecordsByIds(

        "sdkmessageprocessingsteps",

        "sdkmessageprocessingstepid",

        componentIds,

        [
            "sdkmessageprocessingstepid",
            "name",
            "stage",
            "mode",
            "rank",
            "statecode",
            "statuscode",
            "supporteddeployment",
            "ismanaged",
            "componentstate",
            "_eventhandler_value",
            "_sdkmessageid_value",
            "_sdkmessagefilterid_value"
        ]
            .join(",")
    );
}


// ============================================================
// SOLUTION CHOICES
// ============================================================

async function getSolutionChoices(
    componentIds
) {

    const cleanIds =
        (
            componentIds ||
            []
        )
            .map(
                id =>
                    cleanGuid(
                        id
                    )
            )
            .filter(Boolean);


    if (
        !cleanIds.length
    ) {

        return [];
    }


    const metadata =
        await dataverseFetch(

            `${window.location.origin}` +
            "/api/data/v9.2/GlobalOptionSetDefinitions" +
            "?$select=" +
            "MetadataId," +
            "Name," +
            "DisplayName," +
            "IsCustomOptionSet"
        );


    const idSet =
        new Set(

            cleanIds.map(
                id =>
                    normalizeGuid(
                        id
                    )
            )
        );


    return (
        metadata.value ||
        []
    )
        .filter(
            optionSet =>

                idSet.has(

                    normalizeGuid(
                        optionSet.MetadataId
                    )
                )
        );
}


// ============================================================
// COMPLETE SOLUTION EXPLORER DATA
// ============================================================

async function getSolutionExplorerData(
    request
) {

    try {

        const solutionId =
            request.solutionId;


        if (
            !solutionId
        ) {

            return {

                success:
                    false,

                error:
                    "Solution ID is required."
            };
        }


        const results =
            await Promise.allSettled([

                getSolutionWorkflows(
                    request.workflowComponentIds
                ),

                getSolutionWebResources(
                    request.webResourceComponentIds
                ),

                getSolutionForms(
                    request.formComponentIds
                ),

                getSolutionViews(
                    request.viewComponentIds
                ),

                getSolutionEnvironmentVariables(
                    request.environmentVariableComponentIds
                ),

                getSolutionConnectionReferences(
                    request.connectionReferenceComponentIds
                ),

                getSolutionPluginAssemblies(
                    request.pluginAssemblyComponentIds
                ),

                getSolutionPluginTypes(
                    request.pluginTypeComponentIds
                ),

                getSolutionPluginSteps(
                    request.pluginStepComponentIds
                ),

                getSolutionChoices(
                    request.choiceComponentIds
                )
            ]);


        function getValue(
            index
        ) {

            return results[index].status ===
                "fulfilled"

                ? results[index].value
                : [];
        }


        const names = [

            "workflows",
            "webResources",
            "forms",
            "views",
            "environmentVariables",
            "connectionReferences",
            "pluginAssemblies",
            "pluginTypes",
            "pluginSteps",
            "choices"
        ];


        const errors =
            results
                .map(
                    function (
                        result,
                        index
                    ) {

                        if (
                            result.status ===
                            "fulfilled"
                        ) {

                            return null;
                        }


                        return {

                            component:
                                names[index],

                            message:

                                result.reason
                                    ?.message ||
                                String(
                                    result.reason
                                )
                        };
                    }
                )
                .filter(Boolean);


        return {

            success:
                true,

            workflows:
                getValue(
                    0
                ),

            webResources:
                getValue(
                    1
                ),

            forms:
                getValue(
                    2
                ),

            views:
                getValue(
                    3
                ),

            environmentVariables:
                getValue(
                    4
                ),

            connectionReferences:
                getValue(
                    5
                ),

            pluginAssemblies:
                getValue(
                    6
                ),

            pluginTypes:
                getValue(
                    7
                ),

            pluginSteps:
                getValue(
                    8
                ),

            choices:
                getValue(
                    9
                ),

            errors
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// TARGET ENVIRONMENT IDENTITY
// ============================================================

async function getTargetEnvironmentInfo() {

    try {

        const who =
            await dataverseFetch(

                `${window.location.origin}` +
                "/api/data/v9.2/WhoAmI"
            );


        let organization =
            null;


        try {

            const organizations =
                await fetchAllPages(

                    `${window.location.origin}` +
                    "/api/data/v9.2/organizations" +
                    "?$select=organizationid,name"
                );


            organization =
                organizations[0] ||
                null;
        }
        catch (
        error
        ) {

            console.warn(
                "Release Guardian: organization details unavailable.",
                error
            );
        }


        return {

            success:
                true,

            environment: {

                url:
                    window.location.origin,

                host:
                    window.location.hostname,

                organizationId:

                    who.OrganizationId ||
                    organization?.organizationid ||
                    null,

                organizationName:

                    organization?.name ||
                    null,

                userId:

                    who.UserId ||
                    null,

                businessUnitId:

                    who.BusinessUnitId ||
                    null
            }
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// TARGET SOLUTION BY UNIQUE NAME
// ============================================================

async function getTargetSolutionByUniqueName(
    uniqueName
) {

    if (
        !uniqueName
    ) {

        return null;
    }


    const escaped =
        escapeODataString(
            uniqueName
        );


    const query =
        "/api/data/v9.2/solutions" +
        "?$select=" +
        "solutionid," +
        "uniquename," +
        "friendlyname," +
        "version," +
        "ismanaged" +
        `&$filter=uniquename eq '${escaped}'`;


    const records =
        await fetchAllPages(

            `${window.location.origin}${query}`
        );


    return records[0] ||
        null;
}


// ============================================================
// ARRAY CHUNKS
// ============================================================

function rg28Chunk(
    values,
    size
) {

    const chunks =
        [];


    for (
        let index = 0;
        index < values.length;
        index += size
    ) {

        chunks.push(

            values.slice(
                index,
                index + size
            )
        );
    }


    return chunks;
}


// ============================================================
// TARGET COMPONENT PRESENCE
//
// This remains GUID-based evidence only.
//
// Important:
// - exact ID match = strong evidence the component exists.
// - no ID match does NOT prove the component is missing.
// - every solution providing the exact matching component is kept.
// ============================================================

async function checkTargetComponentPresence(
    requiredComponents
) {

    const normalizedMap =
        new Map();


    (
        requiredComponents ||
        []
    )
        .forEach(
            function (item) {

                const objectId =
                    normalizeGuid(
                        item.objectId
                    );


                const componentType =
                    Number(
                        item.componentType
                    );


                if (
                    !objectId ||
                    !Number.isFinite(
                        componentType
                    )
                ) {

                    return;
                }


                const key =
                    `${componentType}:${objectId}`;


                if (
                    !normalizedMap.has(
                        key
                    )
                ) {

                    normalizedMap.set(
                        key,
                        {
                            objectId,
                            componentType
                        }
                    );
                }
            }
        );


    const requested =
        [
            ...normalizedMap.values()
        ];


    if (
        !requested.length
    ) {

        return [];
    }


    const found =
        new Map();


    const solutionIds =
        new Set();


    for (
        const chunk
        of rg28Chunk(
            requested,
            18
        )
    ) {

        const filter =
            chunk
                .map(
                    item =>

                        `(objectid eq ${item.objectId} and componenttype eq ${item.componentType})`
                )
                .join(
                    " or "
                );


        const query =
            "/api/data/v9.2/solutioncomponents" +
            "?$select=" +
            "objectid," +
            "componenttype," +
            "_solutionid_value" +
            `&$filter=${encodeURIComponent(filter)}`;


        const records =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        records.forEach(
            function (record) {

                if (
                    !record.objectid
                ) {

                    return;
                }


                const objectId =
                    normalizeGuid(
                        record.objectid
                    );


                const key =
                    `${record.componenttype}:${objectId}`;


                if (
                    !found.has(
                        key
                    )
                ) {

                    found.set(
                        key,
                        {
                            objectId,

                            componentType:
                                record.componenttype,

                            providers:
                                []
                        }
                    );
                }


                const solutionId =
                    normalizeGuid(

                        record
                            ._solutionid_value
                    );


                if (
                    solutionId
                ) {

                    solutionIds.add(
                        solutionId
                    );


                    found
                        .get(
                            key
                        )
                        .providers
                        .push({

                            solutionId
                        });
                }
            }
        );
    }


    const solutionMap =
        new Map();


    for (
        const chunk
        of rg28Chunk(
            [
                ...solutionIds
            ],
            20
        )
    ) {

        const filter =
            chunk
                .map(
                    id =>
                        `solutionid eq ${id}`
                )
                .join(
                    " or "
                );


        if (
            !filter
        ) {

            continue;
        }


        const query =
            "/api/data/v9.2/solutions" +
            "?$select=" +
            "solutionid," +
            "uniquename," +
            "friendlyname," +
            "version," +
            "ismanaged" +
            `&$filter=${encodeURIComponent(filter)}`;


        const solutions =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        solutions.forEach(
            function (solution) {

                solutionMap.set(

                    normalizeGuid(
                        solution.solutionid
                    ),

                    {
                        solutionId:
                            solution.solutionid,

                        uniqueName:
                            solution.uniquename ||
                            null,

                        friendlyName:

                            solution.friendlyname ||
                            solution.uniquename ||
                            null,

                        version:
                            solution.version ||
                            null,

                        isManaged:
                            solution.ismanaged ===
                            true
                    }
                );
            }
        );
    }


    found.forEach(
        function (component) {

            const uniqueProviders =
                new Map();


            component.providers
                .forEach(
                    function (provider) {

                        const id =
                            normalizeGuid(
                                provider.solutionId
                            );


                        if (
                            !id ||
                            uniqueProviders.has(
                                id
                            )
                        ) {

                            return;
                        }


                        uniqueProviders.set(

                            id,

                            solutionMap.get(
                                id
                            ) ||
                            {
                                solutionId:
                                    provider.solutionId,

                                uniqueName:
                                    null,

                                friendlyName:
                                    null,

                                version:
                                    null,

                                isManaged:
                                    null
                            }
                        );
                    }
                );


            component.providers =
                [
                    ...uniqueProviders.values()
                ];
        }
    );


    return [
        ...found.values()
    ];
}


// ============================================================
// STRING OR FILTER
// ============================================================

function rg28BuildStringOrFilter(
    field,
    values
) {

    const unique =
        [
            ...new Set(

                (
                    values ||
                    []
                )
                    .filter(Boolean)
                    .map(
                        value =>
                            String(
                                value
                            ).trim()
                    )
            )
        ];


    if (
        !unique.length
    ) {

        return "";
    }


    return unique
        .map(
            value =>

                `${field} eq '${escapeODataString(value)}'`
        )
        .join(
            " or "
        );
}
// ============================================================
// TARGET ENVIRONMENT VARIABLES
// ============================================================

async function getTargetEnvironmentVariables(
    sourceVariables
) {

    const schemaNames =
        (
            sourceVariables ||
            []
        )
            .map(
                variable =>
                    variable.schemaname
            )
            .filter(Boolean);


    if (
        !schemaNames.length
    ) {

        return [];
    }


    const definitions =
        [];


    for (
        const chunk
        of rg28Chunk(
            schemaNames,
            20
        )
    ) {

        const filter =
            rg28BuildStringOrFilter(

                "schemaname",
                chunk
            );


        const query =
            "/api/data/v9.2/environmentvariabledefinitions" +
            "?$select=" +
            "environmentvariabledefinitionid," +
            "displayname," +
            "schemaname," +
            "defaultvalue," +
            "type," +
            "isrequired," +
            "ismanaged" +
            `&$filter=${encodeURIComponent(filter)}`;


        const records =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        definitions.push(
            ...records
        );
    }


    const definitionIds =
        definitions
            .map(
                record =>

                    record
                        .environmentvariabledefinitionid
            )
            .filter(Boolean);


    const values =
        [];


    for (
        const chunk
        of rg28Chunk(
            definitionIds,
            20
        )
    ) {

        const filter =
            chunk
                .map(
                    id =>

                        `_environmentvariabledefinitionid_value eq ${cleanGuid(id)}`
                )
                .join(
                    " or "
                );


        if (
            !filter
        ) {

            continue;
        }


        /*
         * We intentionally do not select the environment-variable
         * "value" column here.
         *
         * Target preflight only needs to know whether an active
         * value record exists. This prevents secret values from
         * ever being returned to the side panel.
         */

        const query =
            "/api/data/v9.2/environmentvariablevalues" +
            "?$select=" +
            "environmentvariablevalueid," +
            "statecode," +
            "_environmentvariabledefinitionid_value" +
            `&$filter=${encodeURIComponent(filter)}`;


        const records =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        values.push(
            ...records
        );
    }


    const valuesByDefinition =
        new Map();


    values.forEach(
        function (value) {

            const definitionId =
                normalizeGuid(

                    value
                        ._environmentvariabledefinitionid_value
                );


            if (
                !definitionId
            ) {

                return;
            }


            if (
                !valuesByDefinition.has(
                    definitionId
                )
            ) {

                valuesByDefinition.set(
                    definitionId,
                    []
                );
            }


            valuesByDefinition
                .get(
                    definitionId
                )
                .push(
                    value
                );
        }
    );


    return definitions.map(
        function (definition) {

            const definitionId =
                normalizeGuid(

                    definition
                        .environmentvariabledefinitionid
                );


            const currentValues =
                valuesByDefinition.get(
                    definitionId
                ) ||
                [];


            const activeValue =
                currentValues.find(
                    value =>
                        value.statecode ===
                        0
                );


            return {

                environmentvariabledefinitionid:

                    definition
                        .environmentvariabledefinitionid,

                displayname:
                    definition.displayname,

                schemaname:
                    definition.schemaname,

                type:
                    definition.type,

                isrequired:
                    definition.isrequired,

                ismanaged:
                    definition.ismanaged,

                /*
                 * Presence only.
                 * No target secret/value content is exposed.
                 */
                hasCurrentValue:
                    Boolean(
                        activeValue
                    )
            };
        }
    );
}


// ============================================================
// TARGET CONNECTION REFERENCES
// ============================================================

async function getTargetConnectionReferences(
    sourceReferences
) {

    const logicalNames =
        (
            sourceReferences ||
            []
        )
            .map(
                reference =>

                    reference
                        .connectionreferencelogicalname
            )
            .filter(Boolean);


    if (
        !logicalNames.length
    ) {

        return [];
    }


    const output =
        [];


    for (
        const chunk
        of rg28Chunk(
            logicalNames,
            20
        )
    ) {

        const filter =
            rg28BuildStringOrFilter(

                "connectionreferencelogicalname",
                chunk
            );


        const query =
            "/api/data/v9.2/connectionreferences" +
            "?$select=" +
            "connectionreferenceid," +
            "connectionreferencedisplayname," +
            "connectionreferencelogicalname," +
            "connectorid," +
            "statecode," +
            "ismanaged" +
            `&$filter=${encodeURIComponent(filter)}`;


        const records =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        output.push(
            ...records
        );
    }


    return output;
}


// ============================================================
// TARGET PLUG-IN ASSEMBLIES
// ============================================================

async function getTargetPluginAssemblies(
    sourceAssemblies
) {

    const names =
        (
            sourceAssemblies ||
            []
        )
            .map(
                assembly =>
                    assembly.name
            )
            .filter(Boolean);


    if (
        !names.length
    ) {

        return [];
    }


    const output =
        [];


    for (
        const chunk
        of rg28Chunk(
            names,
            20
        )
    ) {

        const filter =
            rg28BuildStringOrFilter(
                "name",
                chunk
            );


        const query =
            "/api/data/v9.2/pluginassemblies" +
            "?$select=" +
            "pluginassemblyid," +
            "name," +
            "version," +
            "ismanaged," +
            "isolationmode" +
            `&$filter=${encodeURIComponent(filter)}`;


        const records =
            await fetchAllPages(

                `${window.location.origin}${query}`
            );


        output.push(
            ...records
        );
    }


    return output;
}

// ============================================================
// GENERIC DEPENDENCY IDENTITY ENGINE V3
//
// Goals:
// - Resolve dependency IDs whether Dataverse returns a component object ID
//   or a SolutionComponent row ID.
// - Use parent-aware stable identities for tables, columns, forms, views,
//   relationships, choices, flows/processes, web resources, environment
//   variables, connection references and plug-ins.
// - Never turn an ambiguous or weak identity into a false blocker.
// - Isolate resolver failures so one metadata family cannot abort preflight.
// ============================================================

function rgDepText(value) {
    return String(value ?? "").trim();
}

function rgDepLower(value) {
    return rgDepText(value).toLowerCase();
}

function rgDepZeroGuid(value) {
    return normalizeGuid(value) === "00000000-0000-0000-0000-000000000000";
}

function rgDepIdentityKey(identity) {
    if (!identity?.kind) return null;

    switch (identity.kind) {
        case "runtimeRecord":
            return rgRuntimeName(identity.tableLogicalName) && rgRuntimeGuid(identity.recordId)
                ? `runtime:${identity.tableLogicalName}:${normalizeGuid(identity.recordId)}` : null;

        case "table":
            return identity.logicalName ? `table:${rgDepLower(identity.logicalName)}` : null;

        case "column":
            return identity.tableLogicalName && identity.logicalName
                ? `column:${rgDepLower(identity.tableLogicalName)}:${rgDepLower(identity.logicalName)}`
                : null;

        case "relationship":
            return identity.schemaName
                ? `relationship:${rgDepLower(identity.schemaName)}`
                : null;

        case "choice":
            return identity.name ? `choice:${rgDepLower(identity.name)}` : null;

        case "workflow":
            return identity.workflowIdUnique
                ? `workflowidunique:${normalizeGuid(identity.workflowIdUnique)}`
                : identity.name
                    ? `workflow:${Number(identity.category)}:${rgDepLower(identity.name)}`
                    : null;

        case "form":
            return identity.uniqueName
                ? `formunique:${rgDepLower(identity.uniqueName)}`
                : identity.tableLogicalName && identity.name
                    ? `form:${rgDepLower(identity.tableLogicalName)}:${Number(identity.formType ?? -1)}:${rgDepLower(identity.name)}`
                    : null;

        case "view":
            return identity.tableLogicalName && identity.name
                ? `view:${rgDepLower(identity.tableLogicalName)}:${Number(identity.queryType ?? -1)}:${rgDepLower(identity.name)}`
                : null;

        case "webresource":
            return identity.name ? `webresource:${rgDepLower(identity.name)}` : null;

        case "environmentvariable":
            return identity.schemaName ? `environmentvariable:${rgDepLower(identity.schemaName)}` : null;

        case "connectionreference":
            return identity.logicalName ? `connectionreference:${rgDepLower(identity.logicalName)}` : null;

        case "pluginassembly":
            return identity.name ? `pluginassembly:${rgDepLower(identity.name)}` : null;

        case "plugintype":
            return identity.typeName ? `plugintype:${rgDepLower(identity.typeName)}` : null;

        case "pluginstep":
            return identity.name
                ? `pluginstep:${Number(identity.stage ?? -1)}:${Number(identity.mode ?? -1)}:${rgDepLower(identity.name)}`
                : null;

        default:
            return null;
    }
}

function rgDepWithConfidence(identity, confidence, confirmMissingSafe) {
    return {
        ...identity,
        confidence,
        confirmMissingSafe: confirmMissingSafe === true
    };
}

function rgDepSetIdentity(resultMap, item, identity) {
    const originalId = normalizeGuid(item?.objectId);
    if (!originalId || !identity) return;
    resultMap.set(`${Number(item.componentType)}:${originalId}`, identity);
}

async function rgDepFetchByIds(entitySet, idField, ids, selectFields) {
    const cleanIds = [...new Set((ids || []).map(normalizeGuid).filter(Boolean))];
    if (!cleanIds.length) return [];

    const output = [];
    for (const chunk of rg28Chunk(cleanIds, 16)) {
        const filter = chunk.map(id => `${idField} eq ${id}`).join(" or ");
        const query = `/api/data/v9.2/${entitySet}?$select=${selectFields}&$filter=${encodeURIComponent(filter)}`;
        output.push(...await fetchAllPages(`${window.location.origin}${query}`));
    }
    return output;
}

// Dependency payloads can surface IDs that behave like either the component
// object ID or a SolutionComponent row ID. Normalize both forms up front.
async function rgDepHydrateSolutionComponentReferences(items) {
    const cloned = (items || []).map(item => ({
        ...item,
        objectId: normalizeGuid(item.objectId),
        parentId: normalizeGuid(item.parentId)
    }));

    const ids = [...new Set(cloned.flatMap(item => [item.objectId, item.parentId])
        .filter(id => id && !rgDepZeroGuid(id)))];

    if (!ids.length) return cloned;

    const byInputId = new Map();
    const rows = [];

    for (const chunk of rg28Chunk(ids, 8)) {
        const clauses = chunk.flatMap(id => [
            `solutioncomponentid eq ${id}`,
            `objectid eq ${id}`
        ]);

        try {
            rows.push(...await fetchAllPages(
                `${window.location.origin}/api/data/v9.2/solutioncomponents` +
                `?$select=solutioncomponentid,objectid,componenttype,rootsolutioncomponentid` +
                `&$filter=${encodeURIComponent(clauses.join(" or "))}`
            ));
        }
        catch (_) {
            // Hydration is an enhancement. Original IDs remain usable.
        }
    }

    // Prefer an exact SolutionComponent primary-key match over an object-id
    // match because it tells us the underlying component ObjectId.
    rows.forEach(row => {
        const scId = normalizeGuid(row.solutioncomponentid);
        const objectId = normalizeGuid(row.objectid);
        if (scId && ids.includes(scId)) {
            byInputId.set(scId, {
                objectId: objectId || scId,
                componentType: Number(row.componenttype),
                rootSolutionComponentId: normalizeGuid(row.rootsolutioncomponentid),
                source: "solutioncomponentid"
            });
        }
    });

    rows.forEach(row => {
        const objectId = normalizeGuid(row.objectid);
        if (!objectId || !ids.includes(objectId) || byInputId.has(objectId)) return;
        byInputId.set(objectId, {
            objectId,
            componentType: Number(row.componenttype),
            rootSolutionComponentId: normalizeGuid(row.rootsolutioncomponentid),
            source: "objectid"
        });
    });

    const rootIds = [...new Set([...byInputId.values()]
        .map(info => info.rootSolutionComponentId)
        .filter(id => id && !rgDepZeroGuid(id)))];
    const rootObjectBySolutionComponentId = new Map();

    if (rootIds.length) {
        try {
            const rootRows = await rgDepFetchByIds(
                "solutioncomponents",
                "solutioncomponentid",
                rootIds,
                "solutioncomponentid,objectid,componenttype"
            );
            rootRows.forEach(row => {
                rootObjectBySolutionComponentId.set(
                    normalizeGuid(row.solutioncomponentid),
                    normalizeGuid(row.objectid)
                );
            });
        }
        catch (_) { }
    }

    return cloned.map(item => {
        const objectInfo = byInputId.get(item.objectId);
        const parentInfo = item.parentId ? byInputId.get(item.parentId) : null;
        const rootObjectId = objectInfo?.rootSolutionComponentId
            ? rootObjectBySolutionComponentId.get(objectInfo.rootSolutionComponentId)
            : null;

        return {
            ...item,
            resolvedObjectId: objectInfo?.objectId || item.objectId,
            resolvedParentId:
                parentInfo?.objectId ||
                (item.parentId && !rgDepZeroGuid(item.parentId) ? item.parentId : null) ||
                rootObjectId ||
                null,
            solutionComponentResolution: objectInfo?.source || null
        };
    });
}

async function rgDepResolveTableIdentities(items, resultMap) {
    const cleanItems = (items || []).filter(item => item?.objectId);
    if (!cleanItems.length) return;

    const unresolved = new Map(cleanItems.map(item => [normalizeGuid(item.objectId), item]));

    for (const chunk of rg28Chunk(cleanItems, 12)) {
        const results = await Promise.allSettled(
            chunk.map(item => dataverseFetch(
                `${window.location.origin}/api/data/v9.2/EntityDefinitions(${item.resolvedObjectId || item.objectId})` +
                `?$select=MetadataId,LogicalName,SchemaName,DisplayName`
            ))
        );

        results.forEach((result, index) => {
            if (result.status !== "fulfilled" || !result.value?.LogicalName) return;
            const item = chunk[index];
            rgDepSetIdentity(resultMap, item, rgDepWithConfidence({
                kind: "table",
                logicalName: result.value.LogicalName,
                schemaName: result.value.SchemaName,
                displayName:
                    result.value.DisplayName?.UserLocalizedLabel?.Label ||
                    result.value.DisplayName?.LocalizedLabels?.[0]?.Label ||
                    result.value.SchemaName ||
                    result.value.LogicalName
            }, "high", true));
            unresolved.delete(normalizeGuid(item.objectId));
        });
    }

    // Final fallback: load lightweight table metadata once and match either
    // the original dependency ID or the hydrated component ObjectId locally.
    if (unresolved.size) {
        try {
            const rows = await fetchAllPages(
                `${window.location.origin}/api/data/v9.2/EntityDefinitions` +
                `?$select=MetadataId,LogicalName,SchemaName,DisplayName`
            );
            const byId = new Map(rows.map(row => [normalizeGuid(row.MetadataId), row]));

            unresolved.forEach(item => {
                const row = byId.get(normalizeGuid(item.resolvedObjectId)) || byId.get(normalizeGuid(item.objectId));
                if (!row?.LogicalName) return;
                rgDepSetIdentity(resultMap, item, rgDepWithConfidence({
                    kind: "table",
                    logicalName: row.LogicalName,
                    schemaName: row.SchemaName,
                    displayName:
                        row.DisplayName?.UserLocalizedLabel?.Label ||
                        row.DisplayName?.LocalizedLabels?.[0]?.Label ||
                        row.SchemaName ||
                        row.LogicalName
                }, "high", true));
            });
        }
        catch (_) { }
    }
}

async function rgDepResolveColumnIdentities(items, resultMap) {
    const cleanItems = (items || []).filter(item => item?.objectId);
    if (!cleanItems.length) return;

    const byParent = new Map();
    cleanItems.forEach(item => {
        const parentId = normalizeGuid(item.resolvedParentId);
        if (!parentId || rgDepZeroGuid(parentId)) return;
        if (!byParent.has(parentId)) byParent.set(parentId, []);
        byParent.get(parentId).push(item);
    });

    for (const [parentId, parentItems] of byParent.entries()) {
        let table = null;
        try {
            table = await dataverseFetch(
                `${window.location.origin}/api/data/v9.2/EntityDefinitions(${parentId})` +
                `?$select=MetadataId,LogicalName,SchemaName,DisplayName`
            );
        }
        catch (_) { }
        if (!table?.LogicalName) continue;

        const wantedByResolved = new Map(parentItems.map(item => [normalizeGuid(item.resolvedObjectId || item.objectId), item]));
        let rows = [];

        try {
            const filter = [...wantedByResolved.keys()].map(id => `MetadataId eq ${id}`).join(" or ");
            rows = await fetchAllPages(
                `${window.location.origin}/api/data/v9.2/EntityDefinitions(${parentId})/Attributes` +
                `?$select=MetadataId,LogicalName,SchemaName,DisplayName` +
                `&$filter=${encodeURIComponent(filter)}`
            );
        }
        catch (_) {
            try {
                rows = await fetchAllPages(
                    `${window.location.origin}/api/data/v9.2/EntityDefinitions(${parentId})/Attributes` +
                    `?$select=MetadataId,LogicalName,SchemaName,DisplayName`
                );
            }
            catch (_) { }
        }

        rows.forEach(row => {
            const item = wantedByResolved.get(normalizeGuid(row.MetadataId));
            if (!item || !row?.LogicalName) return;
            rgDepSetIdentity(resultMap, item, rgDepWithConfidence({
                kind: "column",
                tableLogicalName: table.LogicalName,
                tableSchemaName: table.SchemaName,
                tableDisplayName:
                    table.DisplayName?.UserLocalizedLabel?.Label ||
                    table.DisplayName?.LocalizedLabels?.[0]?.Label ||
                    table.SchemaName ||
                    table.LogicalName,
                logicalName: row.LogicalName,
                schemaName: row.SchemaName,
                displayName:
                    row.DisplayName?.UserLocalizedLabel?.Label ||
                    row.DisplayName?.LocalizedLabels?.[0]?.Label ||
                    row.SchemaName ||
                    row.LogicalName
            }, "high", true));
        });
    }
}

async function rgDepResolveRelationshipIdentities(items, resultMap) {
    for (const item of items || []) {
        const id = normalizeGuid(item.resolvedObjectId || item.objectId);
        if (!id) continue;
        try {
            const row = await dataverseFetch(
                `${window.location.origin}/api/data/v9.2/RelationshipDefinitions(${id})` +
                `?$select=MetadataId,SchemaName`
            );
            if (!row?.SchemaName) continue;
            rgDepSetIdentity(resultMap, item, rgDepWithConfidence({
                kind: "relationship",
                schemaName: row.SchemaName
            }, "high", true));
        }
        catch (_) { }
    }
}

async function rgDepResolveChoiceIdentities(items, resultMap) {
    if (!(items || []).length) return;

    let allChoices = null;
    try {
        allChoices = await fetchAllPages(
            `${window.location.origin}/api/data/v9.2/GlobalOptionSetDefinitions?$select=MetadataId,Name`
        );
    }
    catch (_) { }
    const byId = new Map((allChoices || []).map(row => [normalizeGuid(row.MetadataId), row]));

    for (const item of items || []) {
        const id = normalizeGuid(item.resolvedObjectId || item.objectId);
        if (!id) continue;
        let row = byId.get(id) || null;
        if (!row) {
            try {
                row = await dataverseFetch(
                    `${window.location.origin}/api/data/v9.2/GlobalOptionSetDefinitions(${id})?$select=MetadataId,Name`
                );
            }
            catch (_) { }
        }
        if (row?.Name) {
            rgDepSetIdentity(resultMap, item, rgDepWithConfidence({
                kind: "choice",
                name: row.Name
            }, "high", true));
        }
    }
}

async function rgDepResolveEntityIdentities(items, resultMap) {
    const groups = [
        {
            types: [29], set: "workflows", id: "workflowid",
            select: "workflowid,workflowidunique,name,category",
            make: r => rgDepWithConfidence({
                kind: "workflow",
                workflowIdUnique: r.workflowidunique,
                name: r.name,
                category: r.category
            }, r.workflowidunique ? "high" : "medium", !!r.workflowidunique)
        },
        {
            types: [24, 60], set: "systemforms", id: "formid",
            select: "formid,name,uniquename,objecttypecode,type",
            make: r => rgDepWithConfidence({
                kind: "form",
                uniqueName: r.uniquename,
                name: r.name,
                tableLogicalName: r.objecttypecode,
                formType: r.type
            }, r.uniquename ? "high" : "medium", !!r.uniquename)
        },
        {
            types: [26], set: "savedqueries", id: "savedqueryid",
            select: "savedqueryid,name,returnedtypecode,querytype",
            make: r => rgDepWithConfidence({
                kind: "view",
                name: r.name,
                tableLogicalName: r.returnedtypecode,
                queryType: r.querytype
            }, "medium", false)
        },
        {
            types: [61], set: "webresourceset", id: "webresourceid",
            select: "webresourceid,name,webresourcetype",
            make: r => rgDepWithConfidence({ kind: "webresource", name: r.name, webResourceType: r.webresourcetype }, "high", true)
        },
        {
            types: [380], set: "environmentvariabledefinitions", id: "environmentvariabledefinitionid",
            select: "environmentvariabledefinitionid,schemaname,displayname,type,isrequired",
            make: r => rgDepWithConfidence({ kind: "environmentvariable", schemaName: r.schemaname, displayName: r.displayname, variableType: r.type, isRequired: r.isrequired }, "high", true)
        },
        {
            types: [371], set: "connectionreferences", id: "connectionreferenceid",
            select: "connectionreferenceid,connectionreferencelogicalname,connectionreferencedisplayname,connectorid",
            make: r => rgDepWithConfidence({ kind: "connectionreference", logicalName: r.connectionreferencelogicalname, displayName: r.connectionreferencedisplayname, connectorId: r.connectorid }, "high", true)
        },
        {
            types: [91], set: "pluginassemblies", id: "pluginassemblyid",
            select: "pluginassemblyid,name,version",
            make: r => rgDepWithConfidence({ kind: "pluginassembly", name: r.name, version: r.version }, "high", true)
        },
        {
            types: [90], set: "plugintypes", id: "plugintypeid",
            select: "plugintypeid,typename,name,_pluginassemblyid_value",
            make: r => rgDepWithConfidence({ kind: "plugintype", typeName: r.typename || r.name, assemblyId: r._pluginassemblyid_value }, "high", true)
        },
        {
            types: [92], set: "sdkmessageprocessingsteps", id: "sdkmessageprocessingstepid",
            select: "sdkmessageprocessingstepid,name,stage,mode,_eventhandler_value",
            make: r => rgDepWithConfidence({ kind: "pluginstep", name: r.name, stage: r.stage, mode: r.mode, eventHandlerId: r._eventhandler_value }, "medium", false)
        }
    ];

    for (const group of groups) {
        const groupItems = (items || []).filter(item => group.types.includes(Number(item.componentType)));
        if (!groupItems.length) continue;

        const byResolvedId = new Map(groupItems.map(item => [normalizeGuid(item.resolvedObjectId || item.objectId), item]));
        let rows = [];
        try {
            rows = await rgDepFetchByIds(group.set, group.id, [...byResolvedId.keys()], group.select);
        }
        catch (_) { }

        rows.forEach(row => {
            const item = byResolvedId.get(normalizeGuid(row[group.id]));
            if (!item) return;
            rgDepSetIdentity(resultMap, item, group.make(row));
        });
    }
}

// Organization-specific component codes must be discovered in each environment.
// ObjectTypeCode + an exact record ID gives a name candidate. Verification also
// requires the table's Solution Component Configuration registration.
function rgRuntimeGuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeGuid(value)) && !rgDepZeroGuid(value);
}
function rgRuntimeName(value) { return /^[a-z][a-z0-9_]*$/i.test(value || ""); }
function rgRuntimeLabel(meta) {
    return meta.DisplayName?.UserLocalizedLabel?.Label || meta.DisplayName?.LocalizedLabels?.[0]?.Label || meta.LogicalName;
}
function rgRuntimeKeys(meta) {
    const types = new Map((meta.Attributes || []).map(attr => [attr.LogicalName, attr.AttributeType]));
    return (meta.Keys || []).filter(key => key.EntityKeyIndexStatus === "Active" && key.KeyAttributes?.length)
        .map(key => key.KeyAttributes.map(name => ({ name, type: types.get(name) })))
        .filter(fields => fields.every(field => rgRuntimeName(field.name) && ["String", "Uniqueidentifier", "Integer", "Boolean"].includes(field.type)));
}
function rgRuntimeKeyValues(meta, row) {
    for (const fields of rgRuntimeKeys(meta)) {
        const key = fields.map(field => ({ ...field, value: row[field.name] }));
        if (key.every(field => rgRuntimeLiteral(field) !== null)) return key;
    }
    return null;
}
function rgRuntimeLiteral(field) {
    if (!rgRuntimeName(field.name)) return null;
    if (field.type === "String" && typeof field.value === "string" && field.value.length) return `'${escapeODataString(field.value)}'`;
    if (field.type === "Uniqueidentifier" && rgRuntimeGuid(field.value)) return normalizeGuid(field.value);
    if (field.type === "Integer" && Number.isSafeInteger(field.value)) return String(field.value);
    if (field.type === "Boolean" && typeof field.value === "boolean") return String(field.value);
    return null;
}
const RG_RUNTIME_META_SELECT = "MetadataId,ObjectTypeCode,LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,DisplayName";
const RG_RUNTIME_META_EXPAND = "Attributes($select=LogicalName,AttributeType),Keys($select=KeyAttributes,EntityKeyIndexStatus)";
async function rgRuntimeFetchMetadata(url, collection = false) {
    const read = collection ? fetchAllPages : dataverseFetch;
    try { return await read(url); }
    catch (error) {
        // Some organizations expose basic metadata without key/attribute expansion.
        // Fallback can resolve names and exact IDs; it cannot invent unique keys.
        const basic = new URL(url);
        if (!basic.searchParams.has("$expand")) throw error;
        basic.searchParams.delete("$expand");
        return read(basic.toString());
    }
}
async function rgRuntimeRegistered(meta) {
    if (!rgRuntimeGuid(meta.MetadataId)) return false;
    const rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/solutioncomponentconfigurations` +
        `?$select=name,_entityid_value&$filter=${encodeURIComponent(`_entityid_value eq ${normalizeGuid(meta.MetadataId)}`)}`);
    return rows.some(row => normalizeGuid(row._entityid_value) === normalizeGuid(meta.MetadataId));
}
function rgRuntimeDiagnostic(error) {
    return [401, 403].includes(Number(error?.status))
        ? { code: "access_denied", message: "Dataverse denied access to runtime metadata or component records. Check read permissions for this component table." }
        : { code: "lookup_failed", message: "Runtime metadata or component lookup failed. No absence was inferred; retry the check or inspect table access." };
}
async function rgDepResolveRuntimeIdentities(items, resultMap, diagnostics = new Map()) {
    const key = item => `${item.componentType}:${normalizeGuid(item.objectId)}`;
    const selected = (items || []).filter(item => Number.isInteger(item.componentType) && item.componentType >= 10000 && rgRuntimeGuid(item.objectId) && !resultMap.has(key(item)));
    if (!selected.length) return;
    const types = [...new Set(selected.map(item => item.componentType))];
    const metas = [];
    for (const chunk of rg28Chunk(types, 16)) {
        try {
            metas.push(...await rgRuntimeFetchMetadata(`${window.location.origin}/api/data/v9.2/EntityDefinitions` +
                `?$select=${RG_RUNTIME_META_SELECT}&$expand=${RG_RUNTIME_META_EXPAND}` +
                `&$filter=${encodeURIComponent(chunk.map(type => `ObjectTypeCode eq ${type}`).join(" or "))}`, true));
        } catch (error) {
            selected.filter(item => chunk.includes(item.componentType)).forEach(item => diagnostics.set(key(item), rgRuntimeDiagnostic(error)));
        }
    }
    for (const type of types) {
        const group = selected.filter(item => item.componentType === type);
        const candidates = metas.filter(meta => Number(meta.ObjectTypeCode) === type);
        if (candidates.length !== 1) {
            group.forEach(item => {
                if (!diagnostics.has(key(item))) diagnostics.set(key(item), { code: candidates.length ? "ambiguous_metadata" : "metadata_unavailable",
                    message: candidates.length ? "Multiple runtime tables matched this component code; no table was selected." : "No runtime table mapping was returned for this component code. It remains unverified." });
            });
            continue;
        }
        const meta = candidates[0];
        if (![meta.LogicalName, meta.EntitySetName, meta.PrimaryIdAttribute].every(rgRuntimeName)) continue;
        group.forEach(item => diagnostics.set(key(item), {
            code: "record_not_returned", message: "The runtime table was identified, but its record name has not been resolved.",
            componentTypeLabel: rgRuntimeLabel(meta), tableLogicalName: meta.LogicalName
        }));
        let registered = false;
        try { registered = await rgRuntimeRegistered(meta); } catch (_) { /* Naming can succeed without verification permission. */ }
        const remapped = group.filter(item => item.resolvedObjectId && normalizeGuid(item.resolvedObjectId) !== normalizeGuid(item.objectId));
        const safeIds = new Map(group.map(item => [key(item), normalizeGuid(item.objectId)]));
        for (const chunk of rg28Chunk(remapped, 16)) {
            try {
                const rows = await rgDepFetchByIds("solutioncomponents", "solutioncomponentid", chunk.map(item => item.objectId), "solutioncomponentid,objectid,componenttype");
                for (const item of chunk) {
                    if (rows.some(row => normalizeGuid(row.solutioncomponentid) === normalizeGuid(item.objectId) &&
                        Number(row.componenttype) === type && normalizeGuid(row.objectid) === normalizeGuid(item.resolvedObjectId) && rgRuntimeGuid(row.objectid))) safeIds.set(key(item), normalizeGuid(item.resolvedObjectId));
                }
            } catch (_) { /* Original IDs remain valid candidates. */ }
        }
        const fields = [...new Set([meta.PrimaryIdAttribute,
            ...(rgRuntimeName(meta.PrimaryNameAttribute) ? [meta.PrimaryNameAttribute] : []),
            ...rgRuntimeKeys(meta).flatMap(keyFields => keyFields.map(field => field.name))])];
        for (const chunk of rg28Chunk(group, 16)) {
            try {
                const rows = await rgDepFetchByIds(meta.EntitySetName, meta.PrimaryIdAttribute, chunk.map(item => safeIds.get(key(item))), fields.join(","));
                for (const item of chunk) {
                    const matches = rows.filter(row => normalizeGuid(row[meta.PrimaryIdAttribute]) === safeIds.get(key(item)));
                    if (matches.length !== 1) {
                        diagnostics.set(key(item), { ...diagnostics.get(key(item)), code: matches.length ? "ambiguous_record" : "record_not_returned", message: matches.length ? "Multiple records matched this ID; no identity was selected." : "The component table was identified, but its record was not returned. This is not proof of absence." });
                        continue;
                    }
                    const row = matches[0];
                    rgDepSetIdentity(resultMap, item, {
                        kind: "runtimeRecord", tableLogicalName: meta.LogicalName,
                        componentTypeLabel: rgRuntimeLabel(meta), displayName: row[meta.PrimaryNameAttribute] || null,
                        recordId: normalizeGuid(row[meta.PrimaryIdAttribute]), alternateKey: rgRuntimeKeyValues(meta, row),
                        componentMappingVerified: registered, confidence: registered ? "high" : "medium",
                        // Custom record visibility can be security-trimmed. Never auto-block on absence.
                        confirmMissingSafe: false
                    });
                    if (registered) diagnostics.delete(key(item));
                    else diagnostics.set(key(item), { code: "registration_unverified", message: "The record name was found, but its solution-component table registration could not be verified. Target verification remains pending." });
                }
            } catch (error) { chunk.forEach(item => diagnostics.set(key(item), { ...diagnostics.get(key(item)), ...rgRuntimeDiagnostic(error) })); }
        }
    }
}

async function rgDepMatchTargetRuntimeRecords(identities, matches, checkInfo) {
    const items = identities.filter(item => item.identity?.kind === "runtimeRecord");
    const tables = [...new Set(items.map(item => item.identity.tableLogicalName).filter(rgRuntimeName))];
    for (const table of tables) {
        const group = items.filter(item => item.identity.tableLogicalName === table);
        try {
            const meta = await rgRuntimeFetchMetadata(`${window.location.origin}/api/data/v9.2/EntityDefinitions(LogicalName='${table}')` +
                `?$select=${RG_RUNTIME_META_SELECT}&$expand=${RG_RUNTIME_META_EXPAND}`);
            if (meta.LogicalName !== table || !rgRuntimeName(meta.EntitySetName) || !rgRuntimeName(meta.PrimaryIdAttribute) || !Number.isInteger(meta.ObjectTypeCode)) continue;
            const registered = await rgRuntimeRegistered(meta);
            for (const item of group) {
                const identity = item.identity;
                if (!registered || identity.componentMappingVerified !== true) {
                    checkInfo.set(item.identityKey, { diagnostic: "Solution-component registration was not verified in both environments. The displayed name alone is not a verified match." });
                    continue;
                }
                try {
                    if (!rgRuntimeGuid(identity.recordId)) continue;
                    const exact = await rgDepFetchByIds(meta.EntitySetName, meta.PrimaryIdAttribute, [identity.recordId], meta.PrimaryIdAttribute);
                    let rows = exact;
                    if (!rows.length) {
                        const key = identity.alternateKey;
                        const targetKeys = rgRuntimeKeys(meta);
                        if (!Array.isArray(key) || !key.length || !key.every(field => rgRuntimeLiteral(field) !== null) ||
                            !targetKeys.some(fields => fields.length === key.length && fields.every(field => key.some(source => source.name === field.name && source.type === field.type)))) {
                            checkInfo.set(item.identityKey, { diagnostic: "The source record ID was not found, and no matching active unique key is available in the target. A display-name match would not prove identity." });
                            continue;
                        }
                        const filter = key.map(field => `${field.name} eq ${rgRuntimeLiteral(field)}`).join(" and ");
                        rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/${meta.EntitySetName}?$select=${meta.PrimaryIdAttribute}&$filter=${encodeURIComponent(filter)}`);
                    }
                    checkInfo.set(item.identityKey, { matchCount: rows.length,
                        ...(rows.length === 0 ? { diagnostic: "No matching visible record was returned. Row security can hide records; verify read access and provisioning before deployment." } : {}) });
                    if (rows.length === 1 && rgRuntimeGuid(rows[0][meta.PrimaryIdAttribute])) {
                        matches.set(item.identityKey, { objectId: rows[0][meta.PrimaryIdAttribute], componentType: meta.ObjectTypeCode, matchType: "stableIdentity" });
                    }
                } catch (error) { checkInfo.set(item.identityKey, { diagnostic: rgRuntimeDiagnostic(error).message }); }
            }
        } catch (error) { group.forEach(item => checkInfo.set(item.identityKey, { diagnostic: rgRuntimeDiagnostic(error).message })); }
    }
}

async function resolveDependencyIdentities(request) {
    try {
        const dependencies = request?.dependencies || [];
        const requiredItems = await rgDepHydrateSolutionComponentReferences(
            dependencies.map(item => ({
                objectId: item.objectId,
                componentType: Number(item.componentType),
                parentId: item.raw?.requiredcomponentparentid || null
            })).filter(item => item.objectId && Number.isFinite(item.componentType))
        );

        const dependentItems = await rgDepHydrateSolutionComponentReferences(
            dependencies.map(item => ({
                objectId: item.raw?.dependentcomponentobjectid,
                componentType: Number(item.raw?.dependentcomponenttype),
                parentId: item.raw?.dependentcomponentparentid || null
            })).filter(item => item.objectId && Number.isFinite(item.componentType))
        );

        const resultMap = new Map();
        const dependentMap = new Map();
        const runtimeDiagnostics = new Map();
        const runResolverSafely = async (name, resolver) => {
            try { await resolver(); }
            catch (error) {
                console.warn(`Release Guardian ${name} resolver skipped:`, error?.message || error);
            }
        };

        const resolveSet = async (items, map, prefix) => {
            await runResolverSafely(`${prefix} table`, () => rgDepResolveTableIdentities(items.filter(x => x.componentType === 1), map));
            await runResolverSafely(`${prefix} column`, () => rgDepResolveColumnIdentities(items.filter(x => x.componentType === 2), map));
            await runResolverSafely(`${prefix} relationship`, () => rgDepResolveRelationshipIdentities(items.filter(x => [3, 10].includes(x.componentType)), map));
            await runResolverSafely(`${prefix} choice`, () => rgDepResolveChoiceIdentities(items.filter(x => x.componentType === 9), map));
            await runResolverSafely(`${prefix} entity`, () => rgDepResolveEntityIdentities(items, map));
            await runResolverSafely(`${prefix} runtime`, () => rgDepResolveRuntimeIdentities(items, map, runtimeDiagnostics));
        };

        await resolveSet(requiredItems, resultMap, "required");
        await resolveSet(dependentItems, dependentMap, "dependent");

        const requiredHydratedByKey = new Map(requiredItems.map(item => [`${item.componentType}:${normalizeGuid(item.objectId)}`, item]));

        const resolved = dependencies.map(item => {
            const key = `${Number(item.componentType)}:${normalizeGuid(item.objectId)}`;
            const identity = resultMap.get(key) || null;
            const depType = Number(item.raw?.dependentcomponenttype);
            const depId = normalizeGuid(item.raw?.dependentcomponentobjectid);
            const requiredByIdentity = dependentMap.get(`${depType}:${depId}`) || null;
            const hydrated = requiredHydratedByKey.get(key) || null;

            return {
                ...item,
                resolvedObjectId: hydrated?.resolvedObjectId || item.objectId,
                resolvedParentId: hydrated?.resolvedParentId || item.raw?.requiredcomponentparentid || null,
                identity,
                identityResolution: runtimeDiagnostics.get(key) || null,
                identityKey: rgDepIdentityKey(identity),
                requiredBy: {
                    objectId: item.raw?.dependentcomponentobjectid || null,
                    componentType: item.raw?.dependentcomponenttype ?? null,
                    identity: requiredByIdentity,
                    identityKey: rgDepIdentityKey(requiredByIdentity)
                }
            };
        });

        return { success: true, dependencies: resolved };
    }
    catch (error) {
        return normalizeError(error);
    }
}

function rgDepBuildStringFilter(field, values) {
    const unique = [...new Set((values || []).map(rgDepText).filter(Boolean))];
    return unique.map(value => `${field} eq '${escapeODataString(value)}'`).join(" or ");
}

async function rgDepMatchTargetTables(identities, matches, checkInfo) {
    const list = identities.filter(x => x.identity?.kind === "table");
    for (const chunk of rg28Chunk(list, 18)) {
        const filter = rgDepBuildStringFilter("LogicalName", chunk.map(x => x.identity.logicalName));
        if (!filter) continue;
        try {
            const rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/EntityDefinitions?$select=MetadataId,LogicalName,SchemaName&$filter=${encodeURIComponent(filter)}`);
            const byKey = new Map();
            rows.forEach(row => {
                const key = `table:${rgDepLower(row.LogicalName)}`;
                if (!byKey.has(key)) byKey.set(key, []);
                byKey.get(key).push(row);
            });
            chunk.forEach(item => {
                const rowsForItem = byKey.get(item.identityKey) || [];
                checkInfo.set(item.identityKey, { matchCount: rowsForItem.length });
                if (rowsForItem.length === 1) matches.set(item.identityKey, { objectId: rowsForItem[0].MetadataId, componentType: 1, matchType: "stableIdentity" });
            });
        }
        catch (_) { }
    }
}

async function rgDepMatchTargetColumns(identities, matches, checkInfo) {
    const list = identities.filter(x => x.identity?.kind === "column");
    const byTable = new Map();
    list.forEach(item => {
        const table = rgDepLower(item.identity.tableLogicalName);
        if (!byTable.has(table)) byTable.set(table, []);
        byTable.get(table).push(item);
    });

    for (const [tableLogicalName, items] of byTable.entries()) {
        let table = null;
        try {
            const tableRows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/EntityDefinitions?$select=MetadataId,LogicalName&$filter=${encodeURIComponent(`LogicalName eq '${escapeODataString(tableLogicalName)}'`)}`);
            table = tableRows.length === 1 ? tableRows[0] : null;
        }
        catch (_) { }

        if (!table?.MetadataId) {
            items.forEach(item => checkInfo.set(item.identityKey, { matchCount: 0 }));
            continue;
        }

        for (const chunk of rg28Chunk(items, 18)) {
            let rows = [];
            try {
                const filter = rgDepBuildStringFilter("LogicalName", chunk.map(x => x.identity.logicalName));
                rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/EntityDefinitions(${cleanGuid(table.MetadataId)})/Attributes?$select=MetadataId,LogicalName,SchemaName&$filter=${encodeURIComponent(filter)}`);
            }
            catch (_) {
                try {
                    rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/EntityDefinitions(${cleanGuid(table.MetadataId)})/Attributes?$select=MetadataId,LogicalName,SchemaName`);
                }
                catch (_) { continue; }
            }

            const byLogicalName = new Map();
            rows.forEach(row => {
                const key = rgDepLower(row.LogicalName);
                if (!byLogicalName.has(key)) byLogicalName.set(key, []);
                byLogicalName.get(key).push(row);
            });

            chunk.forEach(item => {
                const rowsForItem = byLogicalName.get(rgDepLower(item.identity.logicalName)) || [];
                checkInfo.set(item.identityKey, { matchCount: rowsForItem.length });
                if (rowsForItem.length === 1) matches.set(item.identityKey, { objectId: rowsForItem[0].MetadataId, componentType: 2, matchType: "stableIdentity" });
            });
        }
    }
}

async function rgDepMatchTargetRelationships(identities, matches, checkInfo) {
    const list = identities.filter(x => x.identity?.kind === "relationship");
    for (const item of list) {
        try {
            const rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/RelationshipDefinitions?$select=MetadataId,SchemaName&$filter=${encodeURIComponent(`SchemaName eq '${escapeODataString(item.identity.schemaName)}'`)}`);
            checkInfo.set(item.identityKey, { matchCount: rows.length });
            if (rows.length === 1) matches.set(item.identityKey, { objectId: rows[0].MetadataId, componentType: Number(item.componentType), matchType: "stableIdentity" });
        }
        catch (_) { }
    }
}

async function rgDepMatchTargetChoices(identities, matches, checkInfo) {
    const list = identities.filter(x => x.identity?.kind === "choice");
    if (!list.length) return;

    try {
        const rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/GlobalOptionSetDefinitions?$select=MetadataId,Name`);
        const byName = new Map();
        rows.forEach(row => {
            const key = rgDepLower(row.Name);
            if (!byName.has(key)) byName.set(key, []);
            byName.get(key).push(row);
        });

        list.forEach(item => {
            const rowsForItem = byName.get(rgDepLower(item.identity.name)) || [];
            checkInfo.set(item.identityKey, { matchCount: rowsForItem.length });
            if (rowsForItem.length === 1) matches.set(item.identityKey, { objectId: rowsForItem[0].MetadataId, componentType: 9, matchType: "stableIdentity" });
        });
    }
    catch (error) {
        console.warn("Release Guardian choice target matching skipped:", error?.message || error);
    }
}

async function rgDepMatchTargetEntitySets(identities, matches, checkInfo) {
    const specs = [
        {
            kind: "workflow", set: "workflows", select: "workflowid,workflowidunique,name,category",
            buildFilter: i => i.workflowIdUnique
                ? `workflowidunique eq ${cleanGuid(i.workflowIdUnique)}`
                : `name eq '${escapeODataString(i.name)}' and category eq ${Number(i.category)}`,
            id: "workflowid"
        },
        {
            kind: "form", set: "systemforms", select: "formid,name,uniquename,objecttypecode,type",
            buildFilter: i => i.uniqueName
                ? `uniquename eq '${escapeODataString(i.uniqueName)}'`
                : `name eq '${escapeODataString(i.name)}' and objecttypecode eq '${escapeODataString(i.tableLogicalName)}'${Number.isFinite(Number(i.formType)) ? ` and type eq ${Number(i.formType)}` : ""}`,
            id: "formid"
        },
        {
            kind: "view", set: "savedqueries", select: "savedqueryid,name,returnedtypecode,querytype",
            buildFilter: i => `name eq '${escapeODataString(i.name)}' and returnedtypecode eq '${escapeODataString(i.tableLogicalName)}'${Number.isFinite(Number(i.queryType)) ? ` and querytype eq ${Number(i.queryType)}` : ""}`,
            id: "savedqueryid"
        },
        { kind: "webresource", set: "webresourceset", select: "webresourceid,name,webresourcetype", buildFilter: i => `name eq '${escapeODataString(i.name)}'`, id: "webresourceid" },
        { kind: "environmentvariable", set: "environmentvariabledefinitions", select: "environmentvariabledefinitionid,schemaname,displayname,type,isrequired", buildFilter: i => `schemaname eq '${escapeODataString(i.schemaName)}'`, id: "environmentvariabledefinitionid" },
        { kind: "connectionreference", set: "connectionreferences", select: "connectionreferenceid,connectionreferencelogicalname,connectionreferencedisplayname,connectorid", buildFilter: i => `connectionreferencelogicalname eq '${escapeODataString(i.logicalName)}'`, id: "connectionreferenceid" },
        { kind: "pluginassembly", set: "pluginassemblies", select: "pluginassemblyid,name,version", buildFilter: i => `name eq '${escapeODataString(i.name)}'`, id: "pluginassemblyid" },
        { kind: "plugintype", set: "plugintypes", select: "plugintypeid,typename,name", buildFilter: i => `typename eq '${escapeODataString(i.typeName)}'`, id: "plugintypeid" },
        { kind: "pluginstep", set: "sdkmessageprocessingsteps", select: "sdkmessageprocessingstepid,name,stage,mode", buildFilter: i => `name eq '${escapeODataString(i.name)}' and stage eq ${Number(i.stage)} and mode eq ${Number(i.mode)}`, id: "sdkmessageprocessingstepid" }
    ];

    for (const spec of specs) {
        const list = identities.filter(x => x.identity?.kind === spec.kind);
        for (const item of list) {
            try {
                const rows = await fetchAllPages(`${window.location.origin}/api/data/v9.2/${spec.set}?$select=${spec.select}&$filter=${encodeURIComponent(spec.buildFilter(item.identity))}`);
                checkInfo.set(item.identityKey, { matchCount: rows.length });
                if (rows.length === 1) {
                    matches.set(item.identityKey, {
                        objectId: rows[0][spec.id],
                        componentType: Number(item.componentType),
                        matchType: "stableIdentity"
                    });
                }
            }
            catch (_) { }
        }
    }
}

async function matchTargetDependencyIdentities(sourceDependencies) {
    const identities = (sourceDependencies || []).filter(x => x.identityKey && x.identity);
    const matches = new Map();
    const checkInfo = new Map();

    const runMatcherSafely = async (name, matcher) => {
        try { await matcher(); }
        catch (error) {
            console.warn(`Release Guardian ${name} target matcher skipped:`, error?.message || error);
        }
    };

    await runMatcherSafely("table", () => rgDepMatchTargetTables(identities, matches, checkInfo));
    await runMatcherSafely("column", () => rgDepMatchTargetColumns(identities, matches, checkInfo));
    await runMatcherSafely("relationship", () => rgDepMatchTargetRelationships(identities, matches, checkInfo));
    await runMatcherSafely("choice", () => rgDepMatchTargetChoices(identities, matches, checkInfo));
    await runMatcherSafely("entity", () => rgDepMatchTargetEntitySets(identities, matches, checkInfo));

    await runMatcherSafely("runtime", () => rgDepMatchTargetRuntimeRecords(identities, matches, checkInfo));

    const matched = identities.map(item => {
        const match = matches.get(item.identityKey);
        return match ? {
            sourceObjectId: item.objectId,
            sourceComponentType: item.componentType,
            identityKey: item.identityKey,
            identity: item.identity,
            ...match
        } : null;
    }).filter(Boolean);

    let providerEvidence = [];
    try {
        providerEvidence = await checkTargetComponentPresence(
            matched.map(item => ({ objectId: item.objectId, componentType: item.componentType }))
        );
    }
    catch (_) { }
    const providerMap = new Map(providerEvidence.map(item => [`${item.componentType}:${normalizeGuid(item.objectId)}`, item]));

    const safeMissingIdentityKeys = [];
    const possibleMissingIdentityKeys = [];
    const ambiguousIdentityKeys = [];

    identities.forEach(item => {
        const info = checkInfo.get(item.identityKey);
        if (!info) return;
        if (info.matchCount === 0) {
            if (item.identity?.kind === "runtimeRecord") return;
            if (item.identity?.confirmMissingSafe === true && item.identity?.kind !== "runtimeRecord") safeMissingIdentityKeys.push(item.identityKey);
            else possibleMissingIdentityKeys.push(item.identityKey);
        }
        else if (info.matchCount > 1) {
            ambiguousIdentityKeys.push(item.identityKey);
        }
    });

    return {
        matches: matched.map(item => ({
            ...item,
            providers: providerMap.get(`${item.componentType}:${normalizeGuid(item.objectId)}`)?.providers || []
        })),
        diagnostics: identities.filter(item => checkInfo.get(item.identityKey)?.diagnostic).map(item => ({
            sourceObjectId: item.objectId, sourceComponentType: item.componentType,
            message: checkInfo.get(item.identityKey).diagnostic
        })),
        checkedIdentityKeys: [...checkInfo.entries()].filter(([, info]) => Number.isInteger(info.matchCount)).map(([key]) => key),
        safeMissingIdentityKeys,
        possibleMissingIdentityKeys,
        ambiguousIdentityKeys
    };
}


// ============================================================
// COMPLETE TARGET PREFLIGHT SNAPSHOT
// ============================================================

async function getTargetPreflightSnapshot(
    request
) {

    try {

        const [

            environmentResult,
            targetSolution,
            components,
            environmentVariables,
            connectionReferences,
            pluginAssemblies,
            semanticMatches

        ] =
            await Promise.all([

                getTargetEnvironmentInfo(),

                getTargetSolutionByUniqueName(
                    request.solutionUniqueName
                ),

                checkTargetComponentPresence(
                    request.requiredComponents ||
                    []
                ),

                getTargetEnvironmentVariables(
                    request.environmentVariables ||
                    []
                ),

                getTargetConnectionReferences(
                    request.connectionReferences ||
                    []
                ),

                getTargetPluginAssemblies(
                    request.pluginAssemblies ||
                    []
                ),

                matchTargetDependencyIdentities(
                    request.dependencyIdentities ||
                    []
                )
            ]);


        if (
            !environmentResult.success
        ) {

            return environmentResult;
        }


        return {

            success:
                true,

            environment:
                environmentResult.environment,

            targetSolution,

            components,

            environmentVariables,

            connectionReferences,

            pluginAssemblies,

            semanticMatches
        };
    }
    catch (
    error
    ) {

        return normalizeError(
            error
        );
    }
}


// ============================================================
// MESSAGE ROUTER
// ============================================================

// Display-only lookups: never feed names or lookup failures into readiness.
async function getDependencyDisplayNames(request) {
    const key = item => `${Number(item.componentType)}:${normalizeGuid(item.objectId)}`;
    const validGuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeGuid(value)) && !rgDepZeroGuid(value);
    const items = [...new Map((request.dependencies || [])
        .filter(item => Number.isInteger(Number(item.componentType)) && validGuid(item.objectId))
        .map(item => [key(item), { ...item, componentType: Number(item.componentType),
            objectId: normalizeGuid(item.objectId), parentId: validGuid(item.parentId) ? normalizeGuid(item.parentId) : null }])).values()];
    const identities = {};
    const diagnostics = {};
    const typeLabels = {};
    const errors = [];
    const origin = `${window.location.origin}/api/data/v9.2/`;
    // Known component-to-table mappings; table/column metadata supplies actual
    // entity-set and primary-name attributes, never a guessed plural or label.
    const entities = new Map([
        [20, "role"], [24, "systemform"], [26, "savedquery"], [29, "workflow"],
        [31, "report"], [36, "template"], [59, "savedqueryvisualization"],
        [60, "systemform"], [61, "webresource"], [90, "plugintype"],
        [91, "pluginassembly"], [92, "sdkmessageprocessingstep"],
        [93, "sdkmessageprocessingstepimage"], [95, "serviceendpoint"],
        [371, "connectionreference"], [380, "environmentvariabledefinition"]
    ]);
    const metadata = new Map();
    const label = value => value?.UserLocalizedLabel?.Label || value?.LocalizedLabels?.[0]?.Label;
    function recordError(selected, error) {
        const status = Number(error.status) || null;
        const code = [401, 403].includes(status) ? "access_denied" : "lookup_failed";
        for (const item of selected) diagnostics[key(item)] = { code, status };
        errors.push({ componentType: selected[0]?.componentType, code, status });
    }
    async function getMetadata(logicalName) {
        if (!metadata.has(logicalName)) {
            metadata.set(logicalName, dataverseFetch(
                `${origin}EntityDefinitions(LogicalName='${logicalName}')` +
                `?$select=EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute` +
                (["workflow", "sdkmessageprocessingstep"].includes(logicalName)
                    ? `&$expand=Attributes($select=LogicalName,AttributeType)` : "")));
        }
        return metadata.get(logicalName);
    }
    async function resolveEntities(selected) {
        const families = [...new Set(selected.map(item => item.componentType).filter(type => entities.has(type)))];
        for (let offset = 0; offset < families.length; offset += 4) {
            await Promise.all(families.slice(offset, offset + 4).map(async type => {
                const familyItems = selected.filter(item => item.componentType === type);
                try {
                    const meta = await getMetadata(entities.get(type));
                    const idField = meta.PrimaryIdAttribute;
                    const nameField = meta.PrimaryNameAttribute;
                    if (!meta.EntitySetName || !idField || !nameField) throw new Error("Primary-name metadata unavailable");
                    // Some dependency payloads contain the unique registration ID
                    // rather than the primary record ID. Only query metadata-confirmed GUID attributes.
                    const alternate = { 29: "workflowidunique", 92: "sdkmessageprocessingstepidunique" }[type];
                    const idFields = [idField];
                    if (alternate && meta.Attributes?.some(attr => attr.LogicalName === alternate && attr.AttributeType === "Uniqueidentifier")) idFields.push(alternate);
                    for (let index = 0; index < familyItems.length; index += 20) {
                        const chunk = familyItems.slice(index, index + 20);
                        try {
                            const ids = [...new Set(chunk.map(item => item.resolvedObjectId || item.objectId))];
                            const filter = ids.flatMap(id => idFields.map(field => `${field} eq ${id}`)).join(" or ");
                            const select = [...new Set([...idFields, nameField])].join(",");
                            const records = await fetchAllPages(`${origin}${meta.EntitySetName}?$select=${select}&$filter=${encodeURIComponent(filter)}`);
                            for (const item of chunk) {
                                const id = item.resolvedObjectId || item.objectId;
                                const matches = records.filter(row => idFields.some(field => normalizeGuid(row[field]) === id));
                                if (matches.length === 1 && matches[0][nameField]) {
                                    identities[key(item)] = { name: matches[0][nameField], context: "" };
                                    delete diagnostics[key(item)];
                                } else if (matches.length > 1) {
                                    diagnostics[key(item)] = { code: "ambiguous" };
                                }
                            }
                        } catch (error) { recordError(chunk, error); }
                    }
                } catch (error) { recordError(familyItems, error); }
            }));
        }
    }
    async function resolveMetadata(selected) {
        const result = new Map();
        for (const [types, resolver] of [
            [[1], rgDepResolveTableIdentities], [[2], rgDepResolveColumnIdentities],
            [[3, 10], rgDepResolveRelationshipIdentities], [[9], rgDepResolveChoiceIdentities]
        ]) {
            const subset = selected.filter(item => types.includes(item.componentType));
            if (!subset.length) continue;
            try { await resolver(subset, result); }
            catch (error) { recordError(subset, error); }
        }
        for (const [id, value] of result) {
            const name = value.displayName || value.schemaName || value.name || value.logicalName;
            if (name) {
                identities[id] = { name, context: value.tableLogicalName || value.logicalName || "" };
                delete diagnostics[id];
            }
        }
    }
    await resolveEntities(items);
    // Only unresolved records incur SolutionComponent ID normalization.
    const unresolved = items.filter(item => !identities[key(item)]);
    const hydrated = await rgDepHydrateSolutionComponentReferences(unresolved);
    // Do not use a remapped ID from a different component type.
    // The shared hydrator keeps the original type, so verify remaps explicitly.
    const remapped = hydrated.filter(item => item.resolvedObjectId !== item.objectId);
    const safeRemapped = [];
    for (let index = 0; index < remapped.length; index += 20) {
        const chunk = remapped.slice(index, index + 20);
        try {
            const rows = await fetchRecordsByIds("solutioncomponents", "solutioncomponentid",
                chunk.map(item => item.objectId), "solutioncomponentid,objectid,componenttype");
            for (const item of chunk) {
                if (rows.some(row => normalizeGuid(row.solutioncomponentid) === item.objectId &&
                    normalizeGuid(row.objectid) === item.resolvedObjectId && Number(row.componenttype) === item.componentType)) safeRemapped.push(item);
            }
        } catch (error) { recordError(chunk, error); }
    }
    if (safeRemapped.length) await resolveEntities(safeRemapped);
    await resolveMetadata(hydrated.map(item => ({ ...item,
        resolvedObjectId: safeRemapped.some(safe => key(safe) === key(item)) ? item.resolvedObjectId : item.objectId
    })));
    const runtimeMap = new Map();
    const runtimeDiagnostics = new Map();
    await rgDepResolveRuntimeIdentities(hydrated, runtimeMap, runtimeDiagnostics);
    for (const [key, identity] of runtimeMap) {
        if (identity.displayName) identities[key] = { name: identity.displayName, context: identity.componentTypeLabel || identity.tableLogicalName };
        const type = Number(key.split(":")[0]);
        if (identity.componentTypeLabel) typeLabels[type] = identity.componentTypeLabel;
        delete diagnostics[key];
    }
    for (const [key, diagnostic] of runtimeDiagnostics) if (!identities[key]) diagnostics[key] = diagnostic;
    // Runtime labels identify unknown types without inventing record mappings.
    if (items.length) {
        try {
            const meta = await dataverseFetch(`${origin}EntityDefinitions(LogicalName='solutioncomponent')/Attributes(LogicalName='componenttype')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet`);
            for (const option of meta.OptionSet?.Options || []) {
                const text = label(option.Label);
                if (text) typeLabels[option.Value] = text;
            }
        } catch (_) { /* Keep known type labels and every dependency visible. */ }
    }
    for (const item of items) {
        if (!identities[key(item)] && !diagnostics[key(item)]) {
            diagnostics[key(item)] = { code: entities.has(item.componentType) || [1, 2, 3, 9, 10].includes(item.componentType)
                ? "not_retrieved" : "unsupported_type" };
        }
    }
    return { success: true, identities, typeLabels, diagnostics, errors };
}


async function handleReleaseGuardianMessage(
    request
) {

    switch (
    request?.action
    ) {

        case "getReleaseDiffSnapshot":

            return getReleaseDiffSnapshot(request);

        case "getDependencyDisplayNames":

            return getDependencyDisplayNames(request);


        case "whoAmI":

            return whoAmI();


        case "getSolutions":

            return getSolutions();


        case "getSolutionComponents":

            return getSolutionComponents(
                request.solutionId
            );


        case "getMissingDependencies":

            return getMissingDependencies(
                request.solutionUniqueName
            );


        case "getSolutionDependencies":

            return getSolutionDependencies(
                request
            );


        case "getDependencyBundle":

            return getDependencyBundle(
                request.objectId,
                request.componentType
            );


        case "getDependentComponents":

            return getDependentComponents(
                request.objectId,
                request.componentType
            );


        case "getRequiredComponents":

            return getRequiredComponents(
                request.objectId,
                request.componentType
            );


        case "getTableMetadata":

            return getTableMetadata();


        case "getTableDetails":

            return getTableDetails(
                request.metadataId,
                request.logicalName
            );


        case "getSolutionExplorerData":

            return getSolutionExplorerData(
                request
            );


        case "getTargetEnvironmentInfo":

            return getTargetEnvironmentInfo();


        case "resolveDependencyIdentities":

            return resolveDependencyIdentities(
                request
            );


        case "getTargetPreflightSnapshot":

            return getTargetPreflightSnapshot(
                request
            );


        default:

            return {

                success:
                    false,

                status:
                    0,

                error:

                    `Unsupported Release Guardian action: ${request?.action ||
                    "unknown"
                    }`
            };
    }
}


// ============================================================
// CHROME MESSAGE LISTENER
// ============================================================

chrome.runtime.onMessage.addListener(

    function (
        request,
        sender,
        sendResponse
    ) {

        if (
            !request?.action
        ) {

            return false;
        }


        console.debug(
            "Release Guardian message:",
            request.action
        );


        handleReleaseGuardianMessage(
            request
        )
            .then(
                sendResponse
            )
            .catch(
                function (error) {

                    sendResponse(

                        normalizeError(
                            error
                        )
                    );
                }
            );


        /*
         * Keep the message channel open for async Dataverse calls.
         */
        return true;
    }
);