// Release Diff is independent of the prerequisite readiness verdict.
const rgReleaseDiffUI = {
    revision:0, result:null, snapshots:null, filter:'changed', limit:25, busy:false,
    element(id){return document.getElementById(id);},
    initialize(){
        if(this.element('rgScreenDiff'))return;
        const screen=document.createElement('div');screen.id='rgScreenDiff';screen.className='rg-screen';screen.dataset.screen='diff';screen.style.display='none';
        screen.innerHTML=`<div class="rg-screen-header"><h2 tabindex="-1">Release Diff</h2><p>What differs between the selected solutions?</p></div>
            <section class="card rg-release-context"><div id="rgReleaseDirection" class="rg-release-direction"></div>
                <p class="rg-flow-note">Tables, columns, forms and views · live effective definitions. Import effects can vary with solution layers.</p>
                <div class="rg-flow-actions"><button id="rgReleaseRun" class="primary-button" type="button" disabled>Compare release contents</button>
                <button id="rgReleaseChooseTarget" class="secondary-button" type="button">Choose destination</button></div>
                <p id="rgReleaseStatus" role="status" aria-live="polite">Choose a source and target solution to begin.</p></section>
            <section id="rgReleaseResults" class="card" hidden></section>`;
        this.element('rgScreenContainer').append(screen);
        const button=document.createElement('button');button.type='button';button.className='rg-nav-button';button.dataset.rgScreen='diff';button.dataset.rg26Upgraded='true';button.disabled=true;
        button.setAttribute('aria-controls','rgScreenDiff');
        button.innerHTML='<span class="rg26-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/></svg></span><span>Release Diff</span>';
        document.querySelector('[data-rg-screen="readiness"]').before(button);
        button.addEventListener('click',()=>rgShowScreen('diff'));
        this.element('rgReleaseChooseTarget').addEventListener('click',()=>rgShowScreen('readiness'));
        this.element('rgReleaseRun').addEventListener('click',()=>this.run());
        this.refresh();
    },
    context(){
        const source=rg282GetSourceSolution(), target=rg28TargetSolutions.find(item=>item.solutionid===rg28TargetSolutionId);
        const detected=this.element('rg28SourceEnvironment')?.textContent.trim();
        const sourceHost=detected&&detected!=='-'?detected:this.element('environmentHost')?.textContent.trim() || 'Source';
        const targetHost=this.element('rg28TargetTabSelect')?.selectedOptions[0]?.textContent.trim() || 'Select target';
        return {source,target,sourceHost,targetHost};
    },
    direction(){
        const context=this.context();
        if(this.snapshots)return `${this.snapshots.source.environment.host} · v${this.snapshots.source.solution.version} → ${this.snapshots.target.environment.host} · v${this.snapshots.target.solution.version}`;
        return `${context.sourceHost} · v${context.source?.version || '—'} → ${context.targetHost} · v${context.target?.version || '—'}`;
    },
    refresh(){
        if(!this.element('rgScreenDiff'))return;
        const context=this.context();
        this.element('rgReleaseDirection').textContent=this.direction();
        const ready=!!(rgWorkflow.analyzedId && context.source && context.target && rg28TargetTabId && !rgWorkflow.targetBusy);
        this.element('rgReleaseRun').disabled=!ready||this.busy;
        this.element('rgReleaseChooseTarget').textContent=context.target?'Change destination':'Choose destination';
        const nav=document.querySelector('[data-rg-screen="diff"]');if(nav)nav.disabled=!rgWorkflow.analyzedId;
        if(!ready&&!this.busy&&!this.result)this.element('rgReleaseStatus').textContent='Select a verified destination and target solution in Readiness, then compare their contents here.';
        else if(ready&&!this.busy&&!this.result)this.element('rgReleaseStatus').textContent='Ready to compare. Only supported, readable definitions will be compared.';
    },
    invalidate(){
        this.revision++;this.busy=false;this.result=null;this.snapshots=null;this.limit=25;
        if(this.element('rgReleaseResults')){this.element('rgReleaseResults').hidden=true;this.element('rgReleaseResults').replaceChildren();}
        this.refresh();
    },
    async run(){
        const {source,target}=this.context();if(!source||!target||this.busy||this.element('rgReleaseRun').disabled)return;
        const context=rgWorkflow.contextKey(),revision=++this.revision,targetTab=rg28TargetTabId;
        this.busy=true;this.result=null;this.snapshots=null;this.element('rgReleaseResults').hidden=true;this.refresh();
        this.element('rgReleaseStatus').textContent='Reading solution membership and effective definitions in both environments…';
        const call=(isTarget,solutionId)=>new Promise((resolve,reject)=>{
            const success=response=>response?.success?resolve(response):reject(new Error(response?.error||'A release snapshot was unavailable.'));
            const failure=message=>reject(new Error(message));
            if(isTarget)rg28SendMessageToTab(targetTab,{action:'getReleaseDiffSnapshot',solutionId},success,failure);
            else sendDynamicsMessage({action:'getReleaseDiffSnapshot',solutionId},success,failure);
        });
        try{
            const [left,right]=await Promise.all([call(false,source.solutionid),call(true,target.solutionid)]);
            if(revision!==this.revision||context!==rgWorkflow.contextKey())return;
            if(left.schemaVersion!==1||right.schemaVersion!==1 || left.solution?.solutionid?.toLowerCase()!==source.solutionid.toLowerCase() || right.solution?.solutionid?.toLowerCase()!==target.solutionid.toLowerCase())throw new Error('Snapshot identity or version was invalid. Refresh and retry.');
            this.snapshots={source:left,target:right};this.result=RGReleaseDiff.compare(left,right);
            this.filter=this.result.changed.length?'changed':this.result.notCompared.length?'notCompared':'matched';this.limit=25;
            this.element('rgReleaseDirection').textContent=`${left.environment.host} · v${left.solution.version} → ${right.environment.host} · v${right.solution.version}`;
            this.element('rgReleaseStatus').textContent=`Comparison complete: ${this.result.matched.length} identity matches; ${this.result.changed.length} have covered definition differences.`;
            this.render();
        }catch(error){if(revision===this.revision&&context===rgWorkflow.contextKey())this.element('rgReleaseStatus').textContent=`Comparison unavailable: ${error.message}`;}
        finally{if(revision===this.revision){this.busy=false;this.element('rgReleaseRun').disabled=false;}}
    },
    render(){
        const container=this.element('rgReleaseResults'), result=this.result;if(!result)return;
        const esc=rgEscapeHtml;
        const categories={changed:'Changed',matched:'Matched',sourceOnly:'Source only',targetOnly:'Target only',notCompared:'Not compared'};
        const rows=result[this.filter] || [];
        const unsupported=Object.values(this.snapshots.source.unsupported || {}).reduce((a,b)=>a+b,0)+Object.values(this.snapshots.target.unsupported || {}).reduce((a,b)=>a+b,0);
        const diagnostics=[...(this.snapshots.source.diagnostics || []).map(item=>`Source: ${item.message}`),...(this.snapshots.target.diagnostics || []).map(item=>`Target: ${item.message}`)];
        const differentPackages=this.snapshots.source.solution.uniquename!==this.snapshots.target.solution.uniquename;
        container.hidden=false;
        container.innerHTML=`<h3>Release contents</h3>
            ${differentPackages?'<p class="rg-flow-config-count">Different solution unique names are selected. This compares two different packages.</p>':''}
            <p class="rg-flow-note">Changed is a subset of Matched. Matching identities does not mean their definitions are identical. “Only” refers to selected-solution membership, not environment-wide absence or an import/delete prediction.</p>
            <div class="rg-release-filters" aria-label="Release diff categories">${Object.entries(categories).map(([key,label])=>`<button type="button" data-release-filter="${key}" aria-pressed="${key===this.filter}">${label} <strong>${result[key].length}</strong></button>`).join('')}</div>
            <p class="rg-flow-note">${unsupported} inventory entries across both snapshots are outside the four supported component types.</p>
            <div class="rg-release-list">${rows.length?rows.slice(0,this.limit).map(row=>this.row(row)).join(''):'<p class="rg-readiness-empty">No entries in this category.</p>'}</div>
            ${rows.length>this.limit?`<button class="secondary-button" id="rgReleaseMore" type="button">Show more (${rows.length-this.limit} remaining)</button>`:''}
            <details class="rg-flow-disclosure"><summary>Comparison scope &amp; limitations</summary>
                <p class="rg-flow-note">Reads published forms/views and current table/column metadata for explicit and inherited solution members. Table shells, unreadable or unsupported definitions remain Not compared. Managed solution layers and the contents of an original exported ZIP are not reconstructed.</p>
                <p class="rg-flow-note">Tables use logical names; columns use table + logical name; forms use unique names or preserved IDs; views use preserved IDs. Different-ID forms/views with matching names remain ambiguous rather than being matched by name alone.</p>
                <p class="rg-flow-note">Definition coverage: table labels/settings and package scope; column base settings and supported type-specific settings/options; FormXML; view FetchXML, LayoutXML, ColumnSetXML and selected view settings. XML formatting/comments are ignored; meaningful XML IDs, values and child order are retained.</p>
                ${diagnostics.length?`<ul>${[...new Set(diagnostics)].map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}
            </details>`;
        container.querySelectorAll('[data-release-filter]').forEach(button=>button.addEventListener('click',()=>{this.filter=button.dataset.releaseFilter;this.limit=25;this.render();}));
        this.element('rgReleaseMore')?.addEventListener('click',()=>{this.limit+=25;this.render();});
    },
    row(row){
        const esc=rgEscapeHtml,component=row.source||row.target;
        const label={changed:'Covered definition differs',same:'No covered differences',notCompared:'Not compared',sourceOnly:'Source solution only',targetOnly:'Target solution only'}[row.state];
        const changes=row.changes || [];
        return `<details class="rg-release-row"><summary><span><strong>${esc(component.name)}</strong><small>${esc(component.family)}${component.table?` · ${esc(component.table)}`:''}</small></span><span>${esc(label)}</span></summary>
            <div class="rg-release-row-body"><p>${esc(row.reason || (row.state==='same'?'Only the covered properties were compared; this is not full package equality.':row.state==='changed'?'The following covered properties differ in the current environment definitions.':''))}</p>
            ${row.method?`<p>Matched by: ${esc(row.method)}</p>`:''}
            ${changes.length?`<ul>${changes.map(field=>`<li><strong>${esc(field)}</strong>${field.toLowerCase().includes('xml')?'':`<div>Source: ${esc(row.source.definition.previews[field] ?? '(not applicable)')}<br>Target: ${esc(row.target.definition.previews[field] ?? '(not applicable)')}</div>`}</li>`).join('')}</ul>`:''}
            ${row.state==='notCompared'?`<p>${esc([...(row.source?.definition?.missing||[]),...(row.target?.definition?.missing||[])].join(' · '))}</p>`:''}
            <details class="rg-flow-disclosure"><summary>Technical evidence</summary><p>Source ID: <code>${esc(row.source?.id || '—')}</code><br>Target ID: <code>${esc(row.target?.id || '—')}</code></p>
            <p>Membership: ${esc(row.source?.membership || '—')} → ${esc(row.target?.membership || '—')}</p></details></div></details>`;
    }
};
