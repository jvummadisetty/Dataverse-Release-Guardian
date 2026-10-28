const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../DataverseReleaseGuardian/release-diff-review.js'),'utf8'),ctx);
const review=vm.runInContext('RGReleaseReview',ctx);
const row=(id,changes=[],extra={})=>({state:'changed',changes,source:{id:String(id),name:`Component ${id}`,family:'column',table:'account',definition:{complete:true,missing:[]}},...extra});

test('description, label, settings, XML and mixed change summaries are disjoint',()=>{
    const rows=[row(1,['Description']),row(2,['Description','Display labels']),row(3,['MaxLength']),row(4,['FormXML','FetchXML']),row(5,['Display name','LayoutXML'])];
    const summary=review.summary(rows,review.kind);
    assert.equal(summary.get('descriptionOnly'),1);assert.equal(summary.get('textOnly'),1);
    assert.equal(summary.get('settings'),1);assert.equal(summary.get('xml'),1);assert.equal(summary.get('mixed'),1);
    assert.equal([...summary.values()].reduce((a,b)=>a+b),rows.length);
});

test('all 1320 coverage entries receive exactly one primary reason without merging records',()=>{
    const rows=[];
    for(let i=0;i<1320;i++){
        const reason=i<400?'table_shell':i<700?'unsupported_type':i<900?'metadata_unavailable':null;
        const value=row(i,[],{state:'notCompared'});value.source.definition={complete:false,missing:['Unavailable'],issues:reason?[{code:reason}]:[]};
        if(i<1220)value.target={...value.source};
        rows.push(value);
    }
    const counts=review.summary(rows,review.reason);
    assert.equal(counts.get('tableShell'),400);assert.equal(counts.get('unsupportedType'),300);
    assert.equal(counts.get('unavailable'),200);assert.equal(counts.get('incomplete'),320);assert.equal(counts.get('identity'),100);
    assert.equal([...counts.values()].reduce((a,b)=>a+b),1320);
    const groups=review.group(rows,'reason');
    assert.equal(groups.flatMap(group=>group.rows).length,1320);
    assert.equal(new Set(groups.flatMap(group=>group.rows).map(row=>row.source.id)).size,1320);
});

test('legacy combined gaps are not falsely labeled unsupported; table shells remain recognizable',()=>{
    const legacy=row(1,[],{state:'notCompared'});legacy.target={...legacy.source};
    legacy.source.definition={complete:false,missing:['Unsupported or unavailable type-specific settings']};
    assert.equal(review.reason(legacy),'incomplete');
    legacy.source.definition.missing=['Table shell: settings are not a full packaged table definition'];
    assert.equal(review.reason(legacy),'tableShell');
});

test('search and table/type/property/change filters intersect without mutating result data',()=>{
    const rows=[row(1,['Description']),row(2,['MaxLength']),row(3,['Description','MaxLength'])];
    rows[0].source.name='Provider Name';rows[0].source.key='column:account:custom_logical';rows[2].source.table='contact';
    const original=JSON.stringify(rows);
    let filtered=review.filter(rows,{...review.defaults(),query:'provider',table:'account',family:'column',property:'Description',kind:'descriptionOnly'});
    assert.equal(filtered.length,1);assert.equal(filtered[0].source.id,'1');
    filtered=review.filter(rows,{...review.defaults(),property:'Description'});assert.equal(filtered.length,2);
    assert.equal(review.filter(rows,{...review.defaults(),query:'does not exist'}).length,0);
    assert.equal(review.filter(rows,{...review.defaults(),query:'custom_logical'}).length,1);
    review.group(rows,'table');assert.equal(JSON.stringify(rows),original);
});

test('property combination grouping displays a multi-property entry once',()=>{
    const rows=[row(1,['Description','MaxLength']),row(2,['MaxLength','Description']),row(3,['FormXML'])];
    const groups=review.group(rows,'property');
    assert.equal(groups.length,2);assert.equal(groups.flatMap(group=>group.rows).length,3);
    assert.equal(groups.find(group=>group.label==='Description + MaxLength').rows.length,2);
});

test('target-only and unresolved-table entries remain filterable',()=>{
    const targetOnly={state:'targetOnly',target:{id:'t',name:'Target item',family:'view',table:'contact'}};
    const unresolved={state:'notCompared',source:{id:'x',name:'Unknown',family:'column',table:''}};
    assert.equal(review.filter([targetOnly,unresolved],{...review.defaults(),table:'contact'}).length,1);
    assert.equal(review.filter([targetOnly,unresolved],{...review.defaults(),table:'__unresolved__'}).length,1);
});

test('localized previews are readable while literal values stay literal',()=>{
    assert.equal(review.preview('[{"language":1033,"text":"Provider description"}]'),'Language 1033: Provider description');
    assert.equal(review.preview('100'),'100');assert.equal(review.preview('null'),'Not set');
    assert.equal(review.preview('Literal <text>'),'Literal <text>');assert.equal(review.preview(undefined),'(not applicable)');
});
