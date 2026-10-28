const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.join(__dirname,'../DataverseReleaseGuardian');
const context=()=>{
    const ctx=vm.createContext({crypto:webcrypto,TextEncoder,URL,console:{log(){},debug(){},warn(){}},
        window:{location:{origin:'https://uat.crm.dynamics.com',hostname:'uat.crm.dynamics.com'}},
        chrome:{runtime:{onMessage:{addListener(){}}}}});
    vm.runInContext(fs.readFileSync(path.join(root,'release-diff.js'),'utf8'),ctx);
    ctx.diff=vm.runInContext('RGReleaseDiff',ctx);return ctx;
};
const guid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const snap=components=>({components,coverage:{table:true,column:true,form:true,view:true}});
async function record(ctx,family,key,id,values={Setting:'same'}){
    return {family,key,id:guid(id),name:'Same display name',definition:await ctx.diff.definition(values,Object.keys(values))};
}

test('table and column logical identities match across different GUIDs; changed is a subset of matched',async()=>{
    const ctx=context();
    const source=[await record(ctx,'table','table:account',1),await record(ctx,'column','column:account:name',2,{MaxLength:100})];
    const target=[await record(ctx,'table','table:account',8),await record(ctx,'column','column:account:name',9,{MaxLength:200})];
    const result=ctx.diff.compare(snap(source),snap(target));
    assert.equal(result.matched.length,2);assert.equal(result.changed.length,1);
    assert.equal(result.changed[0].changes[0],'MaxLength');
    assert.equal(result.sourceOnly.length,0);assert.equal(result.targetOnly.length,0);
});

test('source-only and target-only are selected-solution membership outcomes',async()=>{
    const ctx=context();const a=await record(ctx,'column','column:account:new',1),b=await record(ctx,'column','column:account:old',2);
    const result=ctx.diff.compare(snap([a]),snap([b]));
    assert.equal(result.sourceOnly.length,1);assert.equal(result.targetOnly.length,1);
    assert.match(result.targetOnly[0].reason,/does not prove environment-wide absence/);
});

test('same view ID pairs renamed views; different-ID same-name views are not guessed matches',async()=>{
    const ctx=context(),a=await record(ctx,'view',`viewid:${guid(1)}`,1,{Name:'Old'});
    a.alias='view:account:0:old';
    const b=await record(ctx,'view',`viewid:${guid(1)}`,1,{Name:'New'});b.alias='view:account:0:new';
    assert.equal(ctx.diff.compare(snap([a]),snap([b])).changed.length,1);
    const c=await record(ctx,'view',`viewid:${guid(2)}`,2,{Name:'Old'});c.alias=a.alias;
    const result=ctx.diff.compare(snap([a]),snap([c]));
    assert.equal(result.matched.length,0);assert.equal(result.notCompared.length,2);assert.equal(result.sourceOnly.length,0);
});

test('unique form names can pair different IDs; duplicate schema keys remain ambiguous',async()=>{
    const ctx=context();const a=await record(ctx,'form','form:account:main:2',1),b=await record(ctx,'form','form:account:main:2',2);
    assert.equal(ctx.diff.compare(snap([a]),snap([b])).matched.length,1);
    const c=await record(ctx,'form','form:account:main:2',3);
    const result=ctx.diff.compare(snap([a,c]),snap([b]));
    assert.equal(result.matched.length,0);assert.equal(result.notCompared.length,3);
});

test('partial opposite inventories and unresolved identities prevent false source-only claims',async()=>{
    const ctx=context(),a=await record(ctx,'table','table:account',1);
    const target=snap([]);target.coverage.table=false;
    assert.equal(ctx.diff.compare(snap([a]),target).sourceOnly.length,0);
    const unknown=await record(ctx,'table',null,2);
    assert.equal(ctx.diff.compare(snap([a]),snap([unknown])).sourceOnly.length,0);
    const conflict=await record(ctx,'table','table:contact',1);
    assert.equal(ctx.diff.compare(snap([a]),snap([conflict])).notCompared.length,2);
});

test('matched identities with incomplete or empty definitions never imply equality',async()=>{
    const ctx=context(),a=await record(ctx,'table','table:account',1),b=await record(ctx,'table','table:account',2);
    b.definition.complete=false;b.definition.missing=['Unreadable setting'];
    const result=ctx.diff.compare(snap([a]),snap([b]));
    assert.equal(result.matched.length,1);assert.equal(result.notCompared.length,1);assert.equal(result.changed.length,0);
    a.definition=await ctx.diff.definition({},[]);b.definition=a.definition;
    assert.equal(ctx.diff.compare(snap([a]),snap([b])).notCompared.length,1);
});

function collector({includeAll=false,failAttributes=false,failSubtype=false,shell=false}={}){
    const ctx=context();vm.runInContext(fs.readFileSync(path.join(root,'content.js'),'utf8'),ctx);
    vm.runInContext(fs.readFileSync(path.join(root,'release-diff-content.js'),'utf8'),ctx);
    const calls=[];
    const labels=text=>({LocalizedLabels:[{LanguageCode:1033,Label:text}]});
    const table={MetadataId:guid(1),LogicalName:'account',SchemaName:'Account',DisplayName:labels('Account'),Description:labels('Description'),OwnershipType:'UserOwned',PrimaryIdAttribute:'accountid',PrimaryNameAttribute:'name',IsActivity:false,IsAuditEnabled:{Value:false}};
    const attr={MetadataId:guid(2),LogicalName:'name',SchemaName:'Name',DisplayName:labels('Name'),Description:labels('Description'),AttributeType:'String',AttributeTypeName:{Value:'StringType'},RequiredLevel:{Value:'None'},IsAuditEnabled:{Value:false},IsValidForAdvancedFind:{Value:true}};
    const inventory=[{componenttype:1,objectid:guid(1),rootcomponentbehavior:shell?2:includeAll?0:1},{componenttype:2,objectid:guid(2)},
        {componenttype:60,objectid:guid(3)},{componenttype:26,objectid:guid(4)},{componenttype:29,objectid:guid(5)}];
    ctx.dataverseFetch=async address=>{
        const url=new URL(address),endpoint=url.pathname.split('/api/data/v9.2/')[1];calls.push(url);
        if(endpoint==='solutioncomponents')return {value:inventory};
        if(endpoint.startsWith('solutions('))return {solutionid:guid(100),friendlyname:'Package',uniquename:'package',version:'1.0.0.2'};
        if(endpoint==='EntityDefinitions')return {value:[table]};
        if(endpoint.endsWith('/Attributes')){
            if(failAttributes)throw Object.assign(new Error('Denied'),{status:403});
            return {value:[attr,...(includeAll?[{...attr,MetadataId:guid(6),LogicalName:'description'}]:[])]};
        }
        if(endpoint.endsWith('StringAttributeMetadata')){
            if(failSubtype)throw new Error('Type unavailable');
            return {value:[{MetadataId:guid(2),MaxLength:100,Format:'Text'},{MetadataId:guid(6),MaxLength:200,Format:'Text'}]};
        }
        if(endpoint==='systemforms')return {value:[{formid:guid(3),name:'Main',uniquename:'main',objecttypecode:'account',type:2,formxml:'<form/>',componentstate:0}]};
        if(endpoint==='savedqueries')return {value:[{savedqueryid:guid(4),name:'Active',returnedtypecode:'account',querytype:0,fetchxml:'<fetch/>',layoutxml:'<grid/>',columnsetxml:null,isdefault:false,isquickfindquery:false,componentstate:0}]};
        return {value:[]};
    };
    return {ctx,calls,inventory,table,attr,run:()=>ctx.getReleaseDiffSnapshot({solutionId:guid(100)})};
}

test('snapshot hashes column settings, includes inherited members, and does not duplicate explicit members',async()=>{
    const h=collector({includeAll:true}),result=await h.run();
    assert.equal(result.success,true);assert.equal(result.environment.host,'uat.crm.dynamics.com');assert.equal(result.solution.version,'1.0.0.2');
    assert.equal(result.components.length,5);assert.equal(result.unsupported[29],1);
    const explicit=result.components.find(row=>row.id===guid(2)),inherited=result.components.find(row=>row.id===guid(6));
    assert.equal(explicit.membership,'explicit');assert.equal(inherited.membership,'inherited');
    assert.equal(explicit.definition.complete,true);assert.equal(explicit.definition.fingerprints.MaxLength.length,64);
    assert.equal(result.components.filter(row=>row.id===guid(3)).length,1);
    assert.ok(h.calls.filter(url=>url.pathname.endsWith('/systemforms')).every(url=>url.searchParams.get('$filter').includes('componentstate eq 0')));
});

test('failed column reads leave placeholders and incomplete coverage; failed subtype reads do not imply unchanged',async()=>{
    const result=await collector({failAttributes:true}).run();
    assert.equal(result.success,true);assert.equal(result.coverage.column,false);
    assert.equal(result.components.find(row=>row.family==='column').definition.complete,false);
    const subtype=await collector({failSubtype:true}).run();
    assert.equal(subtype.components.find(row=>row.family==='column').definition.complete,false);
});

test('table shells and invalid inventory fail conservatively without fabricating definitions',async()=>{
    const shell=await collector({shell:true}).run();
    assert.equal(shell.components.find(row=>row.family==='table').definition.complete,false);
    const h=collector();h.ctx.getSolutionComponents=async()=>({success:false,error:'Read denied'});
    assert.equal((await h.run()).success,false);
    assert.equal((await h.ctx.getReleaseDiffSnapshot({solutionId:'bad'})).success,false);
});


test('fully read but different column types report changed covered fields rather than claiming equality',async()=>{
    const ctx=context(),a=await record(ctx,'column','column:account:value',1,{'Attribute type':'String',MaxLength:100});
    const b=await record(ctx,'column','column:account:value',2,{'Attribute type':'Integer',MinValue:0,MaxValue:100});
    const result=ctx.diff.compare(snap([a]),snap([b]));
    assert.equal(result.changed.length,1);assert.equal(result.notCompared.length,0);
    assert.ok(result.changed[0].changes.includes('Attribute type'));
});

test('snapshot bounds concurrent table metadata work to four',async()=>{
    const h=collector();let active=0,peak=0;
    const tableIds=Array.from({length:9},(_,index)=>guid(index+10));
    h.ctx.getSolutionComponents=async()=>({success:true,components:[...tableIds.map(objectid=>({componenttype:1,objectid,rootcomponentbehavior:1})),{componenttype:2,objectid:guid(200)}]});
    const read=h.ctx.dataverseFetch;
    h.ctx.dataverseFetch=async address=>{
        const endpoint=new URL(address).pathname.split('/api/data/v9.2/')[1];
        if(endpoint==='EntityDefinitions')return {value:tableIds.map((MetadataId,index)=>({...h.table,MetadataId,LogicalName:`custom_${index}`}))};
        if(endpoint.endsWith('/Attributes')){
            active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;
            return {value:[]};
        }
        return read(address);
    };
    const result=await h.run();assert.equal(result.success,true);assert.equal(peak,4);
});

test('unsupported column type details stay explicitly not compared',async()=>{
    const h=collector();h.attr.AttributeType='Virtual';h.attr.AttributeTypeName={Value:'VirtualType'};
    const result=await h.run(),column=result.components.find(row=>row.family==='column');
    assert.equal(column.definition.complete,false);
    assert.ok(column.definition.missing.includes('Unsupported or unavailable type-specific settings'));
});


test('localized preview formatting never changes the definition fingerprint',async()=>{
    const ctx=context();const values={Description:[{language:1033,text:'A description'}]};
    const definition=await ctx.diff.definition(values,['Description']);
    const bytes=new TextEncoder().encode(JSON.stringify(values.Description));
    const expected=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
    assert.equal(definition.previews.Description,'Language 1033: A description');
    assert.equal(definition.fingerprints.Description,expected);
});
