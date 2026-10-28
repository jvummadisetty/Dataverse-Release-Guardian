const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../DataverseReleaseGuardian/content.js'), 'utf8');
const guid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const item = (type, n) => ({ objectId: guid(n), componentType: type });
function harness() {
    const metas = [], records = new Map(), registrations = [], calls = [], denied = new Map();
    const ctx = vm.createContext({ URL, console: { log() {}, debug() {}, warn() {} },
        window: { location: { origin: 'https://fixture.crm.dynamics.com' } },
        chrome: { runtime: { onMessage: { addListener() {} } } } });
    vm.runInContext(source, ctx);
    ctx.dataverseFetch = async address => {
        const url = new URL(address), endpoint = url.pathname.split('/api/data/v9.2/')[1];
        const filter = url.searchParams.get('$filter') || '';
        calls.push(url);
        if (denied.has(endpoint)) throw Object.assign(new Error('Denied'), { status: denied.get(endpoint) });
        if (endpoint === 'EntityDefinitions') {
            const types = [...filter.matchAll(/ObjectTypeCode eq (\d+)/g)].map(m => Number(m[1]));
            return { value: metas.filter(meta => types.includes(meta.ObjectTypeCode)) };
        }
        const logical = endpoint.match(/^EntityDefinitions\(LogicalName='([^']+)'\)$/);
        if (logical) {
            const meta = metas.find(meta => meta.LogicalName === logical[1]);
            if (meta) return meta;
            throw Object.assign(new Error('Not found'), { status: 404 });
        }
        if (endpoint === 'solutioncomponentconfigurations') {
            return { value: registrations.filter(row => filter.includes(row._entityid_value)) };
        }
        const rows = records.get(endpoint) || [];
        // Evaluate fixture filters against the actual fields requested by production code.
        const evaluate = (row, clause) => {
            const match = clause.trim().match(/^(\w+) eq (.*)$/);
            if (!match) return false;
            let literal = match[2];
            let value = literal.startsWith("'") ? literal.slice(1,-1).replace(/''/g,"'")
                : literal === 'true' ? true : literal === 'false' ? false
                : /^\d+$/.test(literal) ? Number(literal) : literal;
            return row[match[1]] === value;
        };
        return { value: rows.filter(row => filter.split(' or ').some(or => or.split(' and ').every(and => evaluate(row,and)))) };
    };
    ctx.checkTargetComponentPresence = async () => [];
    const add = (code, name, { registered = true, key = true } = {}) => {
        const meta = { MetadataId: guid(code), ObjectTypeCode: code, LogicalName: name,
            EntitySetName: `${name}s`, PrimaryIdAttribute: `${name}id`, PrimaryNameAttribute: 'name',
            DisplayName: { UserLocalizedLabel: { Label: `Type ${name}` } },
            Attributes: [{ LogicalName: 'uniquename', AttributeType: 'String' }],
            Keys: key ? [{ EntityKeyIndexStatus: 'Active', KeyAttributes: ['uniquename'] }] : [] };
        metas.push(meta); records.set(meta.EntitySetName, []);
        if (registered) registrations.push({ name, _entityid_value: meta.MetadataId });
        return meta;
    };
    return { ctx, metas, records, registrations, calls, denied, add,
        resolve: dependencies => ctx.resolveDependencyIdentities({ dependencies }),
        match: dependencies => ctx.matchTargetDependencyIdentities(dependencies) };
}

test('all nine runtime records resolve from environment metadata; four same-type names remain separate', async () => {
    const h = harness(), types = [10078,10252,10254,10255,10256,10256,10256,10256,10302];
    for (const type of new Set(types)) h.add(type, `custom_${type}`);
    const dependencies = types.map((type,index) => {
        h.records.get(`custom_${type}s`).push({ [`custom_${type}id`]: guid(index+1), name: 'Repeated display name', uniquename: `unique_${index}` });
        return item(type,index+1);
    });
    const result = await h.resolve(dependencies);
    assert.equal(result.dependencies.length,9);
    assert.equal(new Set(result.dependencies.map(row => row.identityKey)).size,9);
    for (const row of result.dependencies) {
        assert.equal(row.identity.displayName,'Repeated display name');
        assert.equal(row.identity.componentMappingVerified,true);
        assert.equal(row.identity.confirmMissingSafe,false);
        assert.equal(row.identity.componentTypeLabel,`Type custom_${row.componentType}`);
    }
    assert.ok(h.calls.some(url => url.searchParams.get('$filter')?.includes('ObjectTypeCode eq 10256')));
});

test('target discovers its own type code and matches active unique keys when GUIDs differ', async () => {
    const source = harness(); source.add(10256,'custom_rule');
    source.records.get('custom_rules').push({ custom_ruleid: guid(1), name: 'Source label', uniquename: "rule_O'Brien" });
    const resolved = (await source.resolve([item(10256,1)])).dependencies;
    const target = harness(); target.add(10599,'custom_rule');
    target.records.get('custom_rules').push({ custom_ruleid: guid(9), name: 'Different display label', uniquename: "rule_O'Brien" });
    const result = await target.match(resolved);
    assert.equal(result.matches.length,1);
    assert.equal(result.matches[0].sourceComponentType,10256);
    assert.equal(result.matches[0].componentType,10599);
    assert.equal(result.matches[0].objectId,guid(9));
    assert.ok(target.calls.some(url => url.searchParams.get('$filter')?.includes("uniquename eq 'rule_O''Brien'")));
    assert.equal(result.safeMissingIdentityKeys.length,0);
});

test('exact record IDs can verify registered runtime components without alternate keys', async () => {
    const source = harness(); source.add(10078,'custom_action',{key:false});
    source.records.get('custom_actions').push({custom_actionid:guid(1),name:'Action'});
    const resolved = (await source.resolve([item(10078,1)])).dependencies;
    const target = harness(); target.add(10888,'custom_action',{key:false});
    target.records.get('custom_actions').push({custom_actionid:guid(1),name:'Action'});
    assert.equal((await target.match(resolved)).matches.length,1);
});

test('display names alone, inactive keys and unregistered tables never produce verified matches', async () => {
    const source = harness(); source.add(10078,'custom_action');
    source.records.get('custom_actions').push({custom_actionid:guid(1),name:'Same name',uniquename:'unique'});
    const resolved = (await source.resolve([item(10078,1)])).dependencies;
    for (const mode of ['no_key','inactive_key','no_registration']) {
        const target = harness(); const meta = target.add(10099,'custom_action',{registered: mode!=='no_registration',key:mode!=='no_key'});
        if(mode==='inactive_key') meta.Keys[0].EntityKeyIndexStatus='Pending';
        target.records.get('custom_actions').push({custom_actionid:guid(2),name:'Same name',uniquename:'unique'});
        const result=await target.match(resolved);
        assert.equal(result.matches.length,0,mode);
        assert.equal(result.safeMissingIdentityKeys.length,0,mode);
        assert.equal(result.possibleMissingIdentityKeys.length,0,mode);
        assert.ok(result.diagnostics.length,mode);
    }
});

test('zero target rows and permission failures stay unresolved, even if missing-safe is supplied', async () => {
    const source=harness();source.add(10252,'custom_record');
    source.records.get('custom_records').push({custom_recordid:guid(1),name:'Record',uniquename:'unique'});
    const resolved=(await source.resolve([item(10252,1)])).dependencies;
    resolved[0].identity.confirmMissingSafe=true;
    for(const denied of [false,true]) {
        const target=harness();target.add(10399,'custom_record');
        if(denied) target.denied.set('custom_records',403);
        const result=await target.match(resolved);
        assert.equal(result.matches.length,0);
        assert.equal(result.safeMissingIdentityKeys.length,0);
        assert.equal(result.possibleMissingIdentityKeys.length,0);
        assert.ok(result.diagnostics[0].message.includes(denied?'denied':'Row security'));
    }
});

test('duplicate key matches remain ambiguous and are not treated as verified', async () => {
    const source=harness();source.add(10254,'custom_record');
    source.records.get('custom_records').push({custom_recordid:guid(1),name:'Record',uniquename:'unique'});
    const resolved=(await source.resolve([item(10254,1)])).dependencies;
    const target=harness();target.add(10999,'custom_record');
    target.records.get('custom_records').push(...[2,3].map(id=>({custom_recordid:guid(id),name:'Record',uniquename:'unique'})));
    const result=await target.match(resolved);
    assert.equal(result.matches.length,0);
    assert.equal(result.ambiguousIdentityKeys.length,1);
});

test('missing or denied metadata stays diagnostic; known names survive denied registration', async () => {
    const h=harness(); const missing=await h.resolve([item(10302,1)]);
    assert.equal(missing.dependencies[0].identity,null);
    assert.equal(missing.dependencies[0].identityResolution.code,'metadata_unavailable');
    h.denied.set('EntityDefinitions',403);
    assert.equal((await h.resolve([item(10302,1)])).dependencies[0].identityResolution.code,'access_denied');
    h.denied.clear();h.add(10302,'custom_object');h.denied.set('solutioncomponentconfigurations',403);
    h.records.get('custom_objects').push({custom_objectid:guid(1),name:'Visible name',uniquename:'unique'});
    const resolved=(await h.resolve([item(10302,1)])).dependencies[0];
    assert.equal(resolved.identity.displayName,'Visible name');
    assert.equal(resolved.identity.componentMappingVerified,false);
    assert.equal(resolved.identityResolution.code,'registration_unverified');
});

test('SolutionComponent aliases require a matching type before runtime object-ID remapping',async()=>{
    const h=harness();h.add(10255,'custom_object');
    h.records.get('custom_objects').push({custom_objectid:guid(2),name:'Aliased record',uniquename:'unique'});
    h.records.set('solutioncomponents',[{solutioncomponentid:guid(1),objectid:guid(2),componenttype:10255}]);
    assert.equal((await h.resolve([item(10255,1)])).dependencies[0].identity.displayName,'Aliased record');
    h.records.get('solutioncomponents')[0].componenttype=10302;
    assert.equal((await h.resolve([item(10255,1)])).dependencies[0].identity,null);
});

test('runtime discovery also resolves the required-by component and display-only requests',async()=>{
    const h=harness();h.add(10078,'custom_action');h.add(10256,'custom_rule');
    h.records.get('custom_actions').push({custom_actionid:guid(1),name:'Process action',uniquename:'action'});
    h.records.get('custom_rules').push({custom_ruleid:guid(2),name:'Rule name',uniquename:'rule'});
    const request={...item(10256,2),raw:{dependentcomponentobjectid:guid(1),dependentcomponenttype:10078}};
    const resolved=(await h.resolve([request])).dependencies[0];
    assert.equal(resolved.requiredBy.identity.displayName,'Process action');
    const display=await h.ctx.getDependencyDisplayNames({dependencies:[item(10256,2)]});
    assert.equal(display.identities[`10256:${guid(2)}`].name,'Rule name');
    assert.equal(display.typeLabels[10256],'Type custom_rule');
});


test('basic metadata fallback resolves names when key expansion is unavailable',async()=>{
    const h=harness();h.add(10302,'custom_object');
    h.records.get('custom_objects').push({custom_objectid:guid(1),name:'Visible name',uniquename:'unique'});
    const read=h.ctx.dataverseFetch;
    h.ctx.dataverseFetch=async address=>{
        const url=new URL(address);
        if(url.pathname.endsWith('/EntityDefinitions') && url.searchParams.has('$expand')) throw Object.assign(new Error('Unsupported expand'),{status:400});
        const result=await read(address);
        if(url.pathname.endsWith('/EntityDefinitions')) return {value:result.value.map(meta=>({...meta,Keys:undefined,Attributes:undefined}))};
        return result;
    };
    const record=(await h.resolve([item(10302,1)])).dependencies[0];
    assert.equal(record.identity.displayName,'Visible name');
    assert.equal(record.identity.alternateKey,null);
});
