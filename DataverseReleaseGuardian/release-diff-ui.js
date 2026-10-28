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
        this.revision++;this.busy=false;this.result=null;this.snapshots=null;this.resetReview();
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
            this.filter=this.result.changed.length?'changed':this.result.notCompared.length?'notCompared':'matched';this.resetReview();
            this.element('rgReleaseDirection').textContent=`${left.environment.host} · v${left.solution.version} → ${right.environment.host} · v${right.solution.version}`;
            this.element('rgReleaseStatus').textContent=`Comparison complete: ${this.result.matched.length} identity matches; ${this.result.changed.length} have covered definition differences.`;
            this.render();
        }catch(error){if(revision===this.revision&&context===rgWorkflow.contextKey())this.element('rgReleaseStatus').textContent=`Comparison unavailable: ${error.message}`;}
        finally{if(revision===this.revision){this.busy=false;this.element('rgReleaseRun').disabled=false;}}
    },
    resetReview(){
        this.facets=RGReleaseReview.defaults();this.groupBy=this.filter==='notCompared'?'reason':'table';this.limit=25;
    },
    render(focusId,caret){
        const container=this.element('rgReleaseResults'),result=this.result;if(!result)return;
        const review=RGReleaseReview,esc=rgEscapeHtml;
        this.facets ||= review.defaults();this.groupBy ||= this.filter==='notCompared'?'reason':'table';
        const categories={changed:'Changed',matched:'Matched',sourceOnly:'Source only',targetOnly:'Target only',notCompared:'Not compared'};
        const base=result[this.filter] || [],rows=review.filter(base,this.facets);
        const unsupported=Object.values(this.snapshots.source.unsupported || {}).reduce((a,b)=>a+b,0)+Object.values(this.snapshots.target.unsupported || {}).reduce((a,b)=>a+b,0);
        const diagnostics=[...(this.snapshots.source.diagnostics || []).map(item=>`Source: ${item.message}`),...(this.snapshots.target.diagnostics || []).map(item=>`Target: ${item.message}`)];
        const differentPackages=this.snapshots.source.solution.uniquename!==this.snapshots.target.solution.uniquename;
        const canFilterChanges=['changed','matched'].includes(this.filter);
        const option=(value,label,selected)=>`<option value="${esc(value)}"${value===selected?' selected':''}>${esc(label)}</option>`;
        const tables=[...new Set(base.flatMap(review.tables))].sort();
        const properties=[...new Set(base.flatMap(row=>row.changes || []))].sort();
        let summary='';
        if(this.filter==='notCompared'){
            const counts=review.summary(review.filter(base,{...this.facets,reason:''}),review.reason);
            if(this.facets.reason&&!counts.has(this.facets.reason))counts.set(this.facets.reason,0);
            summary=`<section class="rg-release-summary"><h4>Why entries were not compared</h4><p>These are coverage gaps, not confirmed missing components. Counts use the other filters below; each entry has one primary reason.</p>
                <div class="rg-release-review-chips">${[...counts].map(([key,count])=>`<button id="rgReviewReason-${key}" type="button" data-review-reason="${key}" aria-pressed="${this.facets.reason===key}">${esc(review.reasons[key].label)} <strong>${count}</strong></button>`).join('')}</div>
                ${this.facets.reason?`<p><strong>${esc(review.reasons[this.facets.reason].explanation)}</strong> ${esc(review.reasons[this.facets.reason].action)}</p>`:''}</section>`;
        }else if(this.filter==='changed'){
            const counts=review.summary(review.filter(base,{...this.facets,kind:''}),review.kind);
            if(this.facets.kind&&!counts.has(this.facets.kind))counts.set(this.facets.kind,0);
            summary=`<section class="rg-release-summary"><h4>Types of changes</h4><p>Description-only and label changes remain real differences; these groups are not deployment-risk ratings.</p>
                <div class="rg-release-review-chips">${[...counts].map(([key,count])=>`<button id="rgReviewKind-${key}" type="button" data-review-kind="${key}" aria-pressed="${this.facets.kind===key}">${esc(review.kinds[key])} <strong>${count}</strong></button>`).join('')}</div></section>`;
        }
        let remaining=this.limit,shown=0;
        const groups=review.group(rows,this.groupBy);
        const list=groups.map(group=>{
            const visible=group.rows.slice(0,remaining);remaining-=visible.length;shown+=visible.length;
            if(!visible.length)return '';
            return `<details class="rg-release-group" open><summary><strong>${esc(group.label)}</strong><span>${visible.length} shown / ${group.rows.length}</span></summary><div>${visible.map(row=>this.row(row)).join('')}</div></details>`;
        }).join('');
        container.hidden=false;
        container.innerHTML=`<h3>Release contents</h3>
            ${differentPackages?'<p class="rg-flow-config-count">Different solution unique names are selected. This compares two different packages.</p>':''}
            <p class="rg-flow-note">Changed is a subset of Matched. Matching identities does not mean their definitions are identical. “Only” refers to selected-solution membership, not environment-wide absence or an import/delete prediction.</p>
            <div class="rg-release-filters" aria-label="Release diff categories">${Object.entries(categories).map(([key,label])=>`<button id="rgReleaseCategory-${key}" type="button" data-release-filter="${key}" aria-pressed="${key===this.filter}">${label} <strong>${result[key].length}</strong></button>`).join('')}</div>
            ${summary}
            <div class="rg-release-review-controls">
                <label class="rg-release-search">Search components<input id="rgReleaseSearch" type="search" placeholder="Name, table, ID or property" value="${esc(this.facets.query)}" /></label>
                <label>Table<select id="rgReleaseTable">${option('','All tables',this.facets.table)}${tables.map(table=>option(table,review.tableLabel(table),this.facets.table)).join('')}</select></label>
                <label>Component type<select id="rgReleaseFamily">${option('','All types',this.facets.family)}${['table','column','form','view'].map(type=>option(type,type[0].toUpperCase()+type.slice(1),this.facets.family)).join('')}</select></label>
                ${canFilterChanges?`<label>Changed property<select id="rgReleaseProperty">${option('','Any property',this.facets.property)}${properties.map(field=>option(field,field,this.facets.property)).join('')}</select></label>`:''}
                ${this.filter==='matched'?`<label>Comparison outcome<select id="rgReleaseKind">${option('','Any outcome',this.facets.kind)}${Object.entries(review.kinds).map(([key,label])=>option(key,label,this.facets.kind)).join('')}</select></label>`:''}
                <label>Group by<select id="rgReleaseGroup">${option('table','Table',this.groupBy)}${option('family','Component type',this.groupBy)}${canFilterChanges?option('property','Changed properties (combination)',this.groupBy):''}${this.filter==='notCompared'?option('reason','Primary coverage reason',this.groupBy):''}${option('none','No grouping',this.groupBy)}</select></label>
            </div>
            <div class="rg-release-review-status"><p id="rgReleaseShowing" class="rg-flow-note" role="status" aria-live="polite">Showing ${shown} of ${rows.length} matching entries · ${base.length} in this category.</p><button id="rgReleaseClear" class="rg-flow-link" type="button">Clear filters</button></div>
            <div class="rg-release-list">${rows.length?list:'<p class="rg-readiness-empty">No entries match these filters. Clear filters to see the full category.</p>'}</div>
            ${rows.length>this.limit?`<button class="secondary-button" id="rgReleaseMore" type="button">Show more (${rows.length-this.limit} remaining)</button>`:''}
            <details class="rg-flow-disclosure"><summary>Comparison scope &amp; limitations</summary>
                <p class="rg-flow-note">${unsupported} inventory entries across both snapshots are outside the four supported component types.</p>
                <p class="rg-flow-note">Reads published forms/views and current table/column metadata for explicit and inherited solution members. Table shells, unreadable or unsupported definitions remain Not compared. Managed solution layers and the contents of an original exported ZIP are not reconstructed.</p>
                <p class="rg-flow-note">Tables use logical names; columns use table + logical name; forms use unique names or preserved IDs; views use preserved IDs. Different-ID forms/views with matching names remain ambiguous rather than being matched by name alone.</p>
                <p class="rg-flow-note">Definition coverage: table labels/settings and package scope; column base settings and supported type-specific settings/options; FormXML; view FetchXML, LayoutXML, ColumnSetXML and selected view settings. XML formatting/comments are ignored; meaningful XML IDs, values and child order are retained.</p>
                ${diagnostics.length?`<ul>${[...new Set(diagnostics)].map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}
            </details>`;
        container.querySelectorAll('[data-release-filter]').forEach(button=>button.addEventListener('click',()=>{this.filter=button.dataset.releaseFilter;this.resetReview();this.render(`rgReleaseCategory-${this.filter}`);}));
        const set=(key,value,focusId)=>{this.facets[key]=value;this.limit=25;this.render(focusId);};
        for(const [id,key] of [['rgReleaseTable','table'],['rgReleaseFamily','family'],['rgReleaseProperty','property'],['rgReleaseKind','kind']])this.element(id)?.addEventListener('change',event=>set(key,event.target.value,id));
        this.element('rgReleaseSearch').addEventListener('input',event=>{this.facets.query=event.target.value;this.limit=25;this.render('rgReleaseSearch',event.target.selectionStart);});
        this.element('rgReleaseGroup').addEventListener('change',event=>{this.groupBy=event.target.value;this.limit=25;this.render('rgReleaseGroup');});
        this.element('rgReleaseClear').addEventListener('click',()=>{this.resetReview();this.render('rgReleaseClear');});
        container.querySelectorAll('[data-review-reason]').forEach(button=>button.addEventListener('click',()=>set('reason',this.facets.reason===button.dataset.reviewReason?'':button.dataset.reviewReason,`rgReviewReason-${button.dataset.reviewReason}`)));
        container.querySelectorAll('[data-review-kind]').forEach(button=>button.addEventListener('click',()=>set('kind',this.facets.kind===button.dataset.reviewKind?'':button.dataset.reviewKind,`rgReviewKind-${button.dataset.reviewKind}`)));
        this.element('rgReleaseMore')?.addEventListener('click',()=>{const previous=this.limit;this.limit+=25;this.render();container.querySelectorAll('.rg-release-row > summary')[previous]?.focus();});
        if(focusId){const field=this.element(focusId);field?.focus({preventScroll:true});if(Number.isInteger(caret))field?.setSelectionRange(caret,caret);}
    },
    row(row){
        const esc=rgEscapeHtml,component=row.source||row.target;
        const label={changed:'Covered definition differs',same:'No covered differences',notCompared:'Not compared',sourceOnly:'Source solution only',targetOnly:'Target solution only'}[row.state];
        const changes=row.changes || [];
        return `<details class="rg-release-row"><summary><span><strong>${esc(component.name)}</strong><small>${esc(component.family)}${component.table?` · ${esc(component.table)}`:''}</small></span><span>${esc(label)}</span></summary>
            <div class="rg-release-row-body"><p>${esc(row.reason || (row.state==='same'?'Only the covered properties were compared; this is not full package equality.':row.state==='changed'?'The following covered properties differ in the current environment definitions.':''))}</p>
            ${row.method?`<p>Matched by: ${esc(row.method)}</p>`:''}
            ${changes.length?`<ul>${changes.map(field=>`<li><strong>${esc(field)}</strong>${field.toLowerCase().includes('xml')?'':`<div>Source: <span class="rg-release-preview">${esc(RGReleaseReview.preview(row.source.definition.previews[field]))}</span><br>Target: <span class="rg-release-preview">${esc(RGReleaseReview.preview(row.target.definition.previews[field]))}</span></div>`}</li>`).join('')}</ul>`:''}
            ${row.state==='notCompared'?`<p><strong>${esc(RGReleaseReview.reasons[RGReleaseReview.reason(row)].explanation)}</strong> ${esc(RGReleaseReview.reasons[RGReleaseReview.reason(row)].action)}</p>
                <dl class="rg-release-coverage-evidence">${['source','target'].filter(side=>row[side]).map(side=>`<dt>${side==='source'?'Source':'Target'} coverage</dt><dd>${esc([...(row[side].definition?.missing||[]),...(row[side].definition?.issues||[]).map(issue=>issue.detail).filter(Boolean)].join(' · ') || (row[side].definition?.complete?'Covered definition available; identity or inventory evidence was insufficient.':'No additional coverage detail was returned.'))}</dd>`).join('')}</dl>`:''}
            <details class="rg-flow-disclosure"><summary>Technical evidence</summary><p>Source ID: <code>${esc(row.source?.id || '—')}</code><br>Target ID: <code>${esc(row.target?.id || '—')}</code></p>
            <p>Membership: ${esc(row.source?.membership || '—')} → ${esc(row.target?.membership || '—')}</p></details></div></details>`;
    }
};
