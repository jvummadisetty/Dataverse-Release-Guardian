const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../DataverseReleaseGuardian/content.js'), 'utf8');
const guid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const dependency = (type, n, extra = {}) => ({ componentType: type, objectId: guid(n), ...extra });
const key = item => `${item.componentType}:${item.objectId.replace(/[{}]/g, '').toLowerCase()}`;

function harness() {
    const calls = [], records = {}, metadata = {}, failures = {};
    const context = vm.createContext({
        console: { log() {}, debug() {}, warn() {} },
        window: { location: { origin: 'https://test.crm.dynamics.com' } },
        chrome: { runtime: { onMessage: { addListener() {} } } }
    });
    vm.runInContext(source, context);
    context.dataverseFetch = async address => {
        const url = new URL(address), endpoint = url.pathname.split('/api/data/v9.2/')[1];
        calls.push(url);
        const ids = [...(url.searchParams.get('$filter') || '').matchAll(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g)].map(m => m[0]);
        if (failures[endpoint] && (!failures[endpoint].ids || failures[endpoint].ids.some(id => ids.includes(id)))) {
            throw Object.assign(new Error('Request failed'), { status: failures[endpoint].status });
        }
        if (endpoint.includes("Attributes(LogicalName='componenttype')")) return {
            OptionSet: { Options: [{ Value: 36, Label: { UserLocalizedLabel: { Label: 'Email Template' } } }] }
        };
        const match = endpoint.match(/^EntityDefinitions\(LogicalName='([^']+)'\)$/);
        if (match) {
            if (!metadata[match[1]]) throw Object.assign(new Error('Metadata unavailable'), { status: 404 });
            return metadata[match[1]];
        }
        if (records[endpoint]) {
            const rows = records[endpoint].filter(row => ids.some(id =>
                Object.entries(row).some(([field, value]) => value === id && (url.searchParams.get('$filter') || '').includes(`${field} eq ${id}`))));
            // Simulate a second OData page to exercise actual fetchAllPages.
            if (rows.length > 1) {
                const next = `${address}&fixturePage=2`;
                if (url.searchParams.has('fixturePage')) return { value: rows.slice(1) };
                return { value: rows.slice(0, 1), '@odata.nextLink': next };
            }
            return { value: rows };
        }
        if (endpoint.startsWith('RelationshipDefinitions(')) {
            const id = endpoint.match(/\(([^)]+)\)/)[1];
            return { MetadataId: id, SchemaName: 'account_customer' };
        }
        return { value: [] };
    };
    records.solutioncomponents = [];
    function entity(logicalName, set, idField, nameField = 'name', attributes = []) {
        metadata[logicalName] = { EntitySetName: set, PrimaryIdAttribute: idField,
            PrimaryNameAttribute: nameField, Attributes: attributes };
        records[set] = [];
        return records[set];
    }
    return { calls, records, metadata, failures, entity,
        run: dependencies => context.getDependencyDisplayNames({ dependencies }), context };
}

test('mixed dependency families resolve outside solution inventory using real metadata names', async () => {
    const h = harness();
    const families = [
        [20,'role'], [24,'systemform'], [26,'savedquery'], [29,'workflow'], [31,'report'],
        [36,'template'], [59,'savedqueryvisualization'], [60,'systemform'], [61,'webresource'],
        [90,'plugintype'], [91,'pluginassembly'], [92,'sdkmessageprocessingstep'],
        [93,'sdkmessageprocessingstepimage'], [95,'serviceendpoint'],
        [371,'connectionreference'], [380,'environmentvariabledefinition']
    ];
    const dependencies = families.map(([type, logical], index) => {
        const item = dependency(type, index + 1);
        const rows = h.records[`${logical}_actual_set`] || h.entity(logical, `${logical}_actual_set`, `${logical}id`, 'actual_primary_name');
        rows.push({ [`${logical}id`]: item.objectId, actual_primary_name: `${logical} <name>` });
        return item;
    });
    const result = await h.run(dependencies);
    for (const item of dependencies) assert.ok(result.identities[key(item)]?.name.endsWith('<name>'));
    assert.equal(Object.keys(result.identities).length, dependencies.length);
    assert.equal(result.typeLabels[36], 'Email Template');
    assert.equal(Object.keys(result.diagnostics).length, 0);
});

test('large batches normalize and deduplicate IDs, follow pagination, and preserve all names', async () => {
    const h = harness(), rows = h.entity('template', 'templates', 'templateid', 'title');
    const dependencies = Array.from({ length: 65 }, (_, i) => dependency(36, i + 1));
    rows.push(...dependencies.map(item => ({ templateid: item.objectId, title: `Template ${item.objectId}` })));
    const result = await h.run([...dependencies, { ...dependencies[0], objectId: `{${dependencies[0].objectId.toUpperCase()}}` }, dependency(36, 0), { componentType: 36, objectId: 'injected invalid ID' }]);
    assert.equal(Object.keys(result.identities).length, 65);
    for (const url of h.calls.filter(url => url.pathname.endsWith('/templates'))) {
        assert.ok((url.searchParams.get('$filter').match(/templateid eq/g) || []).length <= 20);
    }
    assert.ok(h.calls.some(url => url.searchParams.has('fixturePage')));
});

test('plug-in unique registration IDs resolve only when confirmed by GUID attribute metadata', async () => {
    const h = harness(), item = dependency(92, 1);
    const rows = h.entity('sdkmessageprocessingstep', 'steps', 'sdkmessageprocessingstepid', 'name',
        [{ LogicalName: 'sdkmessageprocessingstepidunique', AttributeType: 'Uniqueidentifier' }]);
    rows.push({ sdkmessageprocessingstepid: guid(2), sdkmessageprocessingstepidunique: item.objectId, name: 'Validate customer' });
    assert.equal((await h.run([item])).identities[key(item)].name, 'Validate customer');
    h.metadata.sdkmessageprocessingstep.Attributes = [];
    assert.equal((await h.run([item])).identities[key(item)], undefined);
});

test('SolutionComponent IDs are remapped to object IDs with verified component type', async () => {
    const h = harness(), item = dependency(92, 1);
    const rows = h.entity('sdkmessageprocessingstep', 'steps', 'sdkmessageprocessingstepid');
    rows.push({ sdkmessageprocessingstepid: guid(2), name: 'Outside solution step' });
    h.records.solutioncomponents.push({ solutioncomponentid: item.objectId, objectid: guid(2), componenttype: 92 });
    assert.equal((await h.run([item])).identities[key(item)].name, 'Outside solution step');
    h.records.solutioncomponents[0].componenttype = 59;
    assert.equal((await h.run([item])).identities[key(item)], undefined);
});

test('one denied batch does not discard later successes or imply missing dependencies', async () => {
    const h = harness(), rows = h.entity('template', 'templates', 'templateid', 'title');
    const dependencies = Array.from({ length: 25 }, (_, i) => dependency(36, i + 1));
    rows.push(...dependencies.map(item => ({ templateid: item.objectId, title: 'Template' })));
    h.failures.templates = { status: 403, ids: [dependencies[0].objectId] };
    const result = await h.run(dependencies);
    assert.equal(Object.keys(result.identities).length, 5);
    assert.equal(result.diagnostics[key(dependencies[0])].code, 'access_denied');
    assert.equal(result.diagnostics[key(dependencies[0])].status, 403);
    assert.equal(result.success, true);
});

test('unsupported, not returned, ambiguous, and failed lookups have distinct diagnostics', async () => {
    const h = harness(), rows = h.entity('template', 'templates', 'templateid', 'title');
    const unsupported = dependency(999, 1), missing = dependency(36, 2), ambiguous = dependency(36, 3), failed = dependency(92, 4);
    rows.push({ templateid: ambiguous.objectId, title: 'One' }, { templateid: ambiguous.objectId, title: 'Two' });
    const result = await h.run([unsupported, missing, ambiguous, failed]);
    assert.equal(result.diagnostics[key(unsupported)].code, 'unsupported_type');
    assert.equal(result.diagnostics[key(missing)].code, 'not_retrieved');
    assert.equal(result.diagnostics[key(ambiguous)].code, 'ambiguous');
    assert.equal(result.diagnostics[key(failed)].code, 'lookup_failed');
    assert.equal(Object.keys(result.identities).length, 0);
});

test('relationship names resolve and no display lookup calls dependency or readiness APIs', async () => {
    const h = harness(), item = dependency(10, 1);
    assert.equal((await h.run([item])).identities[key(item)].name, 'account_customer');
    assert.ok(h.calls.every(url => !/RetrieveDependent|RetrieveRequired|RetrieveMissing|Preflight/.test(url.pathname)));
});

test('empty input avoids network requests', async () => {
    const h = harness();
    assert.equal(Object.keys((await h.run([])).identities).length, 0);
    assert.equal(h.calls.length, 0);
});

test('table, column, and choice metadata resolves dependencies from another table', async () => {
    const h = harness();
    const table = dependency(1, 10), column = dependency(2, 11, { parentId: guid(10) }), choice = dependency(9, 12);
    const base = h.context.dataverseFetch;
    h.context.dataverseFetch = async address => {
        const url = new URL(address), endpoint = url.pathname.split('/api/data/v9.2/')[1];
        if (endpoint === `EntityDefinitions(${table.objectId})`) return {
            MetadataId: table.objectId, LogicalName: 'other_table', SchemaName: 'other_Table',
            DisplayName: { UserLocalizedLabel: { Label: 'Other table' } }
        };
        if (endpoint === `EntityDefinitions(${table.objectId})/Attributes`) return {
            value: [{ MetadataId: column.objectId, LogicalName: 'other_column', SchemaName: 'other_Column',
                DisplayName: { UserLocalizedLabel: { Label: 'Other column' } } }]
        };
        if (endpoint === 'GlobalOptionSetDefinitions') return { value: [{ MetadataId: choice.objectId, Name: 'other_choice' }] };
        return base(address);
    };
    const result = await h.run([table, column, choice]);
    assert.equal(result.identities[key(table)].name, 'Other table');
    assert.equal(result.identities[key(column)].name, 'Other column');
    assert.equal(result.identities[key(column)].context, 'other_table');
    assert.equal(result.identities[key(choice)].name, 'other_choice');
});
