// Presentation-only review helpers. Never change comparison results or readiness.
const RGReleaseReview = (() => {
    const kinds={descriptionOnly:'Description only',textOnly:'Labels and text only',settings:'Settings / structure only',xml:'XML only',mixed:'Mixed changes',same:'No covered differences',notCompared:'Not compared'};
    const reasons={
        tableShell:{label:'Table shells',explanation:'The solution includes a table shell, not a full packaged table definition.',action:'Review its included columns, forms and views; table settings were intentionally not compared.'},
        unsupportedType:{label:'Unsupported type-specific settings',explanation:'This version cannot compare all settings for this component type.',action:'Review those settings manually. The entry remains not compared.'},
        unavailable:{label:'Metadata not returned',explanation:'Required metadata or type-specific settings were not returned by the API.',action:'Check read permissions and retry. An unavailable response is not proof of absence.'},
        incomplete:{label:'Incomplete covered definitions',explanation:'Identity matched, but required comparison properties were unavailable.',action:'Expand an entry to see which properties were unavailable on each side.'},
        identity:{label:'Identity or inventory gaps',explanation:'A reliable match or one-sided package membership could not be established.',action:'Review component IDs and snapshot diagnostics. Matching names alone are insufficient.'}
    };
    const defaults=()=>({query:'',table:'',family:'',property:'',kind:'',reason:''});
    const component=row=>row.source || row.target || {};
    const tables=row=>[...new Set([row.source?.table,row.target?.table].filter(Boolean))].length
        ? [...new Set([row.source?.table,row.target?.table].filter(Boolean))] : ['__unresolved__'];
    const tableLabel=table=>table==='__unresolved__'?'Table not resolved':table;
    function kind(row){
        if(row.state!=='changed')return row.state==='same'?'same':'notCompared';
        const changes=row.changes || [];
        if(changes.length&&changes.every(field=>field==='Description'))return 'descriptionOnly';
        if(changes.length&&changes.every(field=>['Description','Display labels','Display name'].includes(field)))return 'textOnly';
        if(changes.length&&changes.every(field=>/xml$/i.test(field)))return 'xml';
        if(changes.length&&changes.every(field=>!['Description','Display labels','Display name'].includes(field)&&!/xml$/i.test(field)))return 'settings';
        return 'mixed';
    }
    function reason(row){
        const definitions=[row.source?.definition,row.target?.definition].filter(Boolean);
        const issues=definitions.flatMap(def=>def.issues || []);
        const missing=definitions.flatMap(def=>def.missing || []);
        if(issues.some(issue=>issue.code==='table_shell')||missing.some(text=>/^Table shell:/i.test(text)))return 'tableShell';
        if(issues.some(issue=>issue.code==='unsupported_type'))return 'unsupportedType';
        if(issues.some(issue=>['metadata_unavailable','definition_unavailable'].includes(issue.code))||missing.includes('Metadata not returned'))return 'unavailable';
        // Old snapshots used this combined message; do not claim unsupported vs failed reads.
        if(missing.includes('Unsupported or unavailable type-specific settings'))return 'incomplete';
        if(row.source&&row.target&&definitions.some(def=>!def.complete))return 'incomplete';
        return 'identity';
    }
    function filter(rows,facets){
        const query=(facets.query || '').trim().toLowerCase();
        return rows.filter(row=>{
            const record=component(row);
            const search=[record.name,row.source?.name,row.target?.name,...tables(row),record.family,row.source?.id,row.target?.id,row.source?.key,row.target?.key,...(row.changes || [])].filter(Boolean).join(' ').toLowerCase();
            return (!query||search.includes(query))&&(!facets.table||tables(row).includes(facets.table))&&
                (!facets.family||record.family===facets.family)&&(!facets.property||(row.changes || []).includes(facets.property))&&
                (!facets.kind||kind(row)===facets.kind)&&(!facets.reason||reason(row)===facets.reason);
        });
    }
    function summary(rows,classify){
        const counts=new Map();for(const row of rows){const key=classify(row);counts.set(key,(counts.get(key)||0)+1);}return counts;
    }
    function group(rows,by){
        const groups=new Map();
        for(const row of rows){
            const record=component(row);
            const key=by==='family'?record.family || 'Unknown type':by==='property'?(row.changes?.length?[...row.changes].sort().join(' + '):'No changed properties'):
                by==='reason'?reasons[reason(row)].label:by==='none'?'All entries':tableLabel(tables(row)[0]);
            if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
        }
        return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([label,items])=>({label,rows:[...items].sort((a,b)=>{
            const left=component(a),right=component(b);return String(left.name || '').localeCompare(String(right.name || ''))||String(left.id || '').localeCompare(String(right.id || ''));
        })}));
    }
    function preview(value){
        if(value===undefined)return '(not applicable)';
        if(value==='null')return 'Not set';
        try{const parsed=JSON.parse(value);if(Array.isArray(parsed)&&parsed.every(item=>item&&typeof item.text==='string'&&'language' in item))return parsed.length?parsed.map(item=>`Language ${item.language}: ${item.text}`).join('\n'):'No text';}catch(_){}
        return String(value);
    }
    return {defaults,component,tables,tableLabel,kinds,reasons,kind,reason,filter,summary,group,preview};
})();
