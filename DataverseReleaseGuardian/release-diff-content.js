// Snapshot current effective definitions; never exports or mutates a solution.
async function getReleaseDiffSnapshot(request) {
    const solutionId=normalizeGuid(request.solutionId);
    if (!rgRuntimeGuid(solutionId)) return { success:false, error:'A valid solution ID is required.' };
    const origin=`${window.location.origin}/api/data/v9.2/`;
    const families=['table','column','form','view','process','connection reference','web resource','environment variable','security role'];
    const snapshot={ success:true, schemaVersion:1, environment:{host:window.location.hostname}, components:[],
        coverage:Object.fromEntries(families.map(family=>[family,true])), unsupported:{}, diagnostics:[], scope:'Current effective live definitions; exported solution layers are not reconstructed.' };
    const records=new Map();
    const supported={1:'table',2:'column',24:'form',60:'form',26:'view',29:'process',371:'connection reference',61:'web resource',380:'environment variable',20:'security role'};
    const issue=(family,message)=>{snapshot.coverage[family]=false;snapshot.diagnostics.push({family,message});};
    const guid=normalizeGuid;
    const label=value=>(value?.LocalizedLabels || []).map(item=>({language:item.LanguageCode,text:item.Label})).sort((a,b)=>a.language-b.language);
    const name=value=>value?.UserLocalizedLabel?.Label || value?.LocalizedLabels?.[0]?.Label;
    const managed=value=>value && typeof value==='object' && 'Value' in value ? value.Value : value;
    const add=record=>{
        const key=`${record.family}:${record.id}`;
        if (!records.has(key) || records.get(key).membership!=='explicit') records.set(key,record);
    };
    const parallel=async(items,fn)=>{
        for(let offset=0;offset<items.length;offset+=4) await Promise.all(items.slice(offset,offset+4).map(fn));
    };
    const byIds=async(set,id,ids,fields,published=false)=>{
        const result=[];
        for(const chunk of rg28Chunk([...new Set(ids.filter(rgRuntimeGuid))],16)) {
            result.push(...await fetchAllPages(`${origin}${set}?$select=${fields}&$filter=${encodeURIComponent(`(${chunk.map(value=>`${id} eq ${guid(value)}`).join(' or ')})${published?' and componentstate eq 0':''}`)}`));
        }
        return result;
    };
    try {
        const inventory=await getSolutionComponents(solutionId);
        if(!inventory.success) return inventory;
        snapshot.solution=await dataverseFetch(`${origin}solutions(${solutionId})?$select=solutionid,friendlyname,uniquename,version,ismanaged`);
        const components=inventory.components || [];
        const members=new Map();
        components.forEach(component=>{
            const family=supported[Number(component.componenttype)];
            if(!family) {
                const type=Number(component.componenttype);
                snapshot.unsupported[type]=(snapshot.unsupported[type]||0)+1;
                add({family:`Component type ${type}`,id:guid(component.objectid)||String(component.solutioncomponentid||records.size),key:null,
                    name:`Component type ${type}`,componentType:type,table:'',membership:'explicit',
                    definition:{complete:false,fingerprints:{},missing:['Definition comparison is not supported for this component type.'],issues:[{code:'unsupported_type'}]}});
                return;
            }
            const id=guid(component.objectid);
            if(!rgRuntimeGuid(id)) {issue(family,'An inventory row had no usable underlying component ID.');return;}
            members.set(`${family}:${id}`,component);
        });
        const tableMembers=[...members.entries()].filter(([key])=>key.startsWith('table:')).map(([,component])=>component);
        const tableFields='MetadataId,LogicalName,SchemaName,DisplayName,Description,OwnershipType,PrimaryIdAttribute,PrimaryNameAttribute,IsActivity,IsAuditEnabled';
        const tables=[];
        for(const chunk of rg28Chunk(tableMembers,16)) {
            try {tables.push(...await fetchAllPages(`${origin}EntityDefinitions?$select=${tableFields}&$filter=${encodeURIComponent(chunk.map(row=>`MetadataId eq ${guid(row.objectid)}`).join(' or '))}`));}
            catch(_){issue('table','Some table metadata could not be read.');}
        }
        const tableById=new Map(tables.map(table=>[guid(table.MetadataId),table]));
        const columnIds=new Set([...members.keys()].filter(key=>key.startsWith('column:')).map(key=>key.slice(7)));
        const attributeFields='MetadataId,LogicalName,SchemaName,DisplayName,Description,AttributeType,AttributeTypeName,RequiredLevel,IsAuditEnabled,IsValidForAdvancedFind';
        const columnBase=['Schema name','Display labels','Description','Attribute type','Required level','Auditing','Advanced find'];
        const extension={
            String:['StringAttributeMetadata','MaxLength,Format'],Memo:['MemoAttributeMetadata','MaxLength,Format'],
            Integer:['IntegerAttributeMetadata','MinValue,MaxValue,Format'],Decimal:['DecimalAttributeMetadata','MinValue,MaxValue,Precision'],
            Double:['DoubleAttributeMetadata','MinValue,MaxValue,Precision'],Money:['MoneyAttributeMetadata','MinValue,MaxValue,Precision,PrecisionSource'],
            DateTime:['DateTimeAttributeMetadata','Format,DateTimeBehavior'],Lookup:['LookupAttributeMetadata','Targets'],Customer:['LookupAttributeMetadata','Targets'],Owner:['LookupAttributeMetadata','Targets'],
            Picklist:['PicklistAttributeMetadata','DefaultFormValue','OptionSet'],State:['StateAttributeMetadata','','OptionSet'],Status:['StatusAttributeMetadata','','OptionSet'],
            Boolean:['BooleanAttributeMetadata','DefaultValue','OptionSet'],MultiSelectPicklist:['MultiSelectPicklistAttributeMetadata','DefaultFormValue','OptionSet']
        };
        const options=set=>set?{name:set.Name || null,global:set.IsGlobal ?? null,
            options:(set.Options || [set.TrueOption,set.FalseOption].filter(Boolean)).map(option=>({value:option.Value,label:label(option.Label)})).sort((a,b)=>a.value-b.value)}:null;
        async function recordForm(row,membership) {
            const table=row.objecttypecode || '',unique=row.uniquename;
            const values={'FormXML':row.formxml,'Display name':row.name,'Form type':row.type};
            add({family:'form',id:guid(row.formid),name:row.name || unique || 'Unnamed form',table,membership,
                key:unique&&table&&row.type!==undefined?`form:${String(table).toLowerCase()}:${String(unique).toLowerCase()}:${row.type}`:`formid:${guid(row.formid)}`,
                alias:table&&row.name?`form:${String(table).toLowerCase()}:${row.type}:${row.name.toLowerCase()}`:null,
                definition:await RGReleaseDiff.definition(values,Object.keys(values),['FormXML'])});
        }
        async function recordView(row,membership) {
            const values={'FetchXML':row.fetchxml,'LayoutXML':row.layoutxml,'ColumnSetXML':row.columnsetxml,'Display name':row.name,'Query type':row.querytype,'Default view':row.isdefault,'Quick find':row.isquickfindquery};
            // A view name is not a unique schema identity; preserved IDs can still pair it.
            add({family:'view',id:guid(row.savedqueryid),key:`viewid:${guid(row.savedqueryid)}`,
                alias:row.returnedtypecode&&row.name?`view:${String(row.returnedtypecode).toLowerCase()}:${row.querytype}:${row.name.toLowerCase()}`:null,name:row.name || 'Unnamed view',table:row.returnedtypecode || '',membership,
                definition:await RGReleaseDiff.definition(values,Object.keys(values),['FetchXML','LayoutXML',...(row.columnsetxml?['ColumnSetXML']:[])])});
        }
        const formFields='formid,name,uniquename,type,objecttypecode,formxml,componentstate';
        const viewFields='savedqueryid,name,querytype,returnedtypecode,fetchxml,layoutxml,columnsetxml,isdefault,isquickfindquery,componentstate';
        await parallel(tableMembers,async component=>{
            const table=tableById.get(guid(component.objectid));
            if(!table) {issue('table','A table component could not be resolved.');for(const family of ['column','form','view'])issue(family,'A parent table was unresolved.');return;}
            const scope=component.rootcomponentbehavior;
            const all=Number(scope)===0 && scope!==null && scope!==undefined;
            if(![0,1,2].includes(scope===null||scope===undefined?-1:Number(scope)))for(const family of ['column','form','view'])issue(family,'A table subcomponent-inclusion setting was unavailable.');
            const values={'Schema name':table.SchemaName,'Display labels':table.DisplayName===undefined?undefined:label(table.DisplayName),
                'Description':table.Description===undefined?undefined:label(table.Description),'Ownership':table.OwnershipType,
                'Primary name column':table.PrimaryNameAttribute,'Activity table':table.IsActivity,'Auditing':managed(table.IsAuditEnabled),'Package subcomponent behavior':scope===null||scope===undefined?undefined:Number(scope)};
            const tableDefinition=await RGReleaseDiff.definition(values,Object.keys(values));
            if(Number(scope)===2){tableDefinition.complete=false;tableDefinition.missing.push('Table shell: settings are not a full packaged table definition');tableDefinition.issues=[{code:'table_shell'}];}
            add({family:'table',id:guid(table.MetadataId),name:name(table.DisplayName)||table.LogicalName,table:table.LogicalName,
                key:table.LogicalName?`table:${table.LogicalName.toLowerCase()}`:null,membership:'explicit',definition:tableDefinition});
            if(all || columnIds.size) {
                try {
                    const attributes=await fetchAllPages(`${origin}EntityDefinitions(${guid(table.MetadataId)})/Attributes?$select=${attributeFields}`);
                    const selected=attributes.filter(row=>all||columnIds.has(guid(row.MetadataId)));
                    const byKind=new Map();
                    selected.forEach(row=>{
                        const kind=row.AttributeTypeName?.Value==='MultiSelectPicklistType'?'MultiSelectPicklist':row.AttributeType;
                        if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push(row);
                    });
                    for(const [kind,rows] of byKind) {
                        const spec=extension[kind];let details=new Map(),detailRead=true;
                        if(spec) {
                            try {
                                const fields=['MetadataId',...spec[1].split(',').filter(Boolean)].join(',');
                                const data=await fetchAllPages(`${origin}EntityDefinitions(${guid(table.MetadataId)})/Attributes/Microsoft.Dynamics.CRM.${spec[0]}?$select=${fields}${spec[2]?`&$expand=${spec[2]}`:''}`);
                                details=new Map(data.map(row=>[guid(row.MetadataId),row]));
                            }catch(_){detailRead=false;}
                        }
                        for(const row of rows) {
                            const data=details.get(guid(row.MetadataId));
                            const values={'Schema name':row.SchemaName,'Display labels':row.DisplayName===undefined?undefined:label(row.DisplayName),
                                'Description':row.Description===undefined?undefined:label(row.Description),'Attribute type':row.AttributeTypeName?.Value || row.AttributeType,
                                'Required level':managed(row.RequiredLevel),'Auditing':managed(row.IsAuditEnabled),'Advanced find':managed(row.IsValidForAdvancedFind)};
                            const required=[...columnBase];
                            if(spec) {
                                for(const field of spec[1].split(',').filter(Boolean)){required.push(field);values[field]=field==='Targets'&&Array.isArray(data?.[field])?[...data[field]].sort():managed(data?.[field]);}
                                if(spec[2]){required.push('Options');values.Options=data?.OptionSet===undefined?undefined:options(data.OptionSet);}
                            }
                            const definition=await RGReleaseDiff.definition(values,required);
                            if(spec&&(!detailRead||!data) || !spec&&!['Uniqueidentifier','EntityName'].includes(kind)) {
                                definition.complete=false;definition.missing.push('Unsupported or unavailable type-specific settings');
                                definition.issues=[{code:spec?'definition_unavailable':'unsupported_type',detail:spec?'Type-specific settings were not returned.':`Type-specific comparison is not supported for ${kind || 'Unknown'}.`}];
                            }
                            add({family:'column',id:guid(row.MetadataId),name:name(row.DisplayName)||row.LogicalName,table:table.LogicalName,
                                key:row.LogicalName&&table.LogicalName?`column:${table.LogicalName.toLowerCase()}:${row.LogicalName.toLowerCase()}`:null,
                                membership:columnIds.has(guid(row.MetadataId))?'explicit':'inherited',definition});
                        }
                    }
                }catch(_){issue('column',`Column metadata was unavailable for ${table.LogicalName}.`);}
            }
            if(all) {
                try {for(const row of await fetchAllPages(`${origin}systemforms?$select=${formFields}&$filter=${encodeURIComponent(`objecttypecode eq '${escapeODataString(table.LogicalName)}' and componentstate eq 0`)}`))await recordForm(row,'inherited');}
                catch(_){issue('form',`Included forms were unavailable for ${table.LogicalName}.`);}
                try {for(const row of await fetchAllPages(`${origin}savedqueries?$select=${viewFields}&$filter=${encodeURIComponent(`returnedtypecode eq '${escapeODataString(table.LogicalName)}' and componentstate eq 0`)}`))await recordView(row,'inherited');}
                catch(_){issue('view',`Included views were unavailable for ${table.LogicalName}.`);}
            }
        });
        await Promise.all([
            (async()=>{try{const ids=[...members.keys()].filter(key=>key.startsWith('form:')).map(key=>key.slice(5));for(const row of await byIds('systemforms','formid',ids,formFields,true))await recordForm(row,'explicit');}catch(_){issue('form','Explicit form definitions could not all be read.');}})(),
            (async()=>{try{const ids=[...members.keys()].filter(key=>key.startsWith('view:')).map(key=>key.slice(5));for(const row of await byIds('savedqueries','savedqueryid',ids,viewFields,true))await recordView(row,'explicit');}catch(_){issue('view','Explicit view definitions could not all be read.');}})()
        ]);
        // Explicit non-table members. Use schema identities or preserved IDs, never display names.
        const specs=[
            {family:'process',set:'workflows',id:'workflowid',fields:'workflowid,name,category,clientdata,xaml',name:'name'},
            {family:'connection reference',set:'connectionreferences',id:'connectionreferenceid',fields:'connectionreferenceid,connectionreferencelogicalname,connectionreferencedisplayname,connectorid',name:'connectionreferencedisplayname',key:'connectionreferencelogicalname'},
            {family:'web resource',set:'webresourceset',id:'webresourceid',fields:'webresourceid,name,webresourcetype,content',name:'name',key:'name'},
            {family:'environment variable',set:'environmentvariabledefinitions',id:'environmentvariabledefinitionid',fields:'environmentvariabledefinitionid,schemaname,displayname,type,isrequired',name:'displayname',key:'schemaname'},
            {family:'security role',set:'roles',id:'roleid',fields:'roleid,name',name:'name'}
        ];
        await parallel(specs,async spec=>{
            const ids=[...members.values()].filter(item=>supported[Number(item.componenttype)]===spec.family).map(item=>guid(item.objectid));
            if(!ids.length)return;
            try {
                for(const row of await byIds(spec.set,spec.id,ids,spec.fields)) {
                    let values={},required=[],xml=[];
                    if(spec.family==='process') {
                        values={'Display name':row.name,'Process category':row.category};
                        if(row.category===5) {
                            // JSON object key order is not a definition change. Malformed/absent JSON stays incomplete.
                            try {values['Flow definition']=row.clientdata?JSON.parse(row.clientdata):undefined;}catch(_){}
                            required=['Display name','Process category','Flow definition'];
                        }else {values.Xaml=row.xaml;required=['Display name','Process category','Xaml'];xml=['Xaml'];}
                    }else if(spec.family==='connection reference') {
                        values={'Logical name':row.connectionreferencelogicalname,'Display name':row.connectionreferencedisplayname,'Connector':row.connectorid};required=Object.keys(values);
                    }else if(spec.family==='web resource') {
                        values={'Name':row.name,'Resource type':row.webresourcetype,'Content':row.content};required=Object.keys(values);
                    }else if(spec.family==='environment variable') {
                        values={'Schema name':row.schemaname,'Display name':row.displayname,'Type':row.type,'Required':row.isrequired};required=Object.keys(values);
                    }
                    const definition=await RGReleaseDiff.definition(values,required,xml);
                    // Flow payloads/resource contents may contain sensitive configuration; compare hashes without displaying payload previews.
                    for(const field of ['Flow definition','Content'])if(definition.previews[field])definition.previews[field]='Content differs; inspect the definition in the maker portal.';
                    if(spec.family==='security role') {
                        definition.complete=false;definition.missing.push('Role privileges and access depths have not been compared.');definition.issues=[{code:'unsupported_type'}];
                    }
                    const id=guid(row[spec.id]);
                    add({family:spec.family,id,name:row[spec.name]||spec.family,table:'',membership:'explicit',
                        key:spec.key&&row[spec.key]?`${spec.family}:${String(row[spec.key]).toLowerCase()}`:`${spec.family}id:${id}`,definition});
                }
            }catch(_){issue(spec.family,`${spec.family} definitions could not be read.`);}
        });
        for(const [key,component] of members)if(!records.has(key)) {
            const family=supported[Number(component.componenttype)];issue(family,'A packaged component identity or definition was not returned.');
            add({family,id:guid(component.objectid),key:null,name:`Unresolved ${family}`,table:'',membership:'explicit',definition:{complete:false,fingerprints:{},missing:['Metadata not returned'],issues:[{code:'metadata_unavailable'}]}});
        }
        snapshot.components=[...records.values()];
        snapshot.inventoryCount=components.length;
        return snapshot;
    }catch(error){return {success:false,error:error.message || 'Release snapshot failed.'};}
}
