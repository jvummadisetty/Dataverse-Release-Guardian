// Run with Node, Playwright and Chromium installed; no app dependencies added.
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require('playwright');
const guid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
async function mockChrome() {
    const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
    const tabs = [
        { id: 1, url: 'https://dev.crm.dynamics.com/main.aspx', title: 'Dynamics DEV' },
        { id: 2, url: 'https://uat.crm.dynamics.com/main.aspx', title: 'Dynamics UAT' },
        { id: 3, url: 'https://prod.crm.dynamics.com/main.aspx', title: 'Dynamics PROD' }
    ];
    window.fixture = { activeTab: 1, calls: [], failConnection: false, failAnalysis: false, failSource: false, failTarget: false, delayTarget: 0, pendingAnalysis: false, targetOutcome: "verified", failDiff: false, delayDiff: 0 };
    window.chrome = {
        runtime: { lastError: null, onMessage: { addListener() {} } },
        tabs: {
            query: async query => query.active ? [tabs.find(tab => tab.id === fixture.activeTab)] : tabs,
            get: async tabId => tabs.find(tab => tab.id === tabId),
            sendMessage: (tabId, request, callback) => {
                fixture.calls.push({ tabId, ...request });
                let response = { success: true };
                if (request.action === 'getReleaseDiffSnapshot') {
                    const target=tabId!==1;
                    const definition=(field,value,complete=true)=>({complete,fingerprints:{[field]:String(value)},previews:{[field]:String(value)},missing:complete?[]:['XML unavailable']});
                    const record=(family,key,n,field,value)=>({family,key,id:id(n),name:family==='form'?'Main <form>':`${family} definition`,table:'account',membership:'explicit',definition:definition(field,value)});
                    response=fixture.failDiff&&target?{success:false,error:'Target snapshot denied'}:{
                        success:true,schemaVersion:1,environment:{host:target?'uat.crm.dynamics.com':'dev.crm.dynamics.com'},
                        solution:{solutionid:request.solutionId,uniquename:'CareManagement',version:target?'1.22.0.44':'1.22.0.45'},
                        coverage:{table:true,column:true,form:true,view:true},unsupported:{29:3},diagnostics:[],components:[
                            record('table','table:account',target?120:20,'Setting','same'),
                            record('column','column:account:name',target?121:21,'MaxLength',target?200:100),
                            record('form','form:account:main:2',target?122:22,'FormXML','same XML'),
                            record('view',`viewid:${id(23)}`,23,'FetchXML',target?'target XML':'source XML'),
                            target?record('column','column:account:target_only',41,'Setting','target'):record('column','column:account:source_only',40,'Setting','source'),
                            {...record('form','form:account:unavailable:2',target?125:25,'FormXML','missing'),definition:definition('FormXML','missing',false)}
                        ]
                    };
                }
                if (request.action === 'whoAmI') response = fixture.failConnection || tabId !== 1 && fixture.failTarget
                    ? { success: false, status: 403 } : { success: true, data: { UserId: id(10), OrganizationId: id(11) } };
                if (request.action === 'getSolutions') response = { success: true, solutions: [
                    { solutionid: id(tabId === 1 ? 1 : 3), uniquename: 'CareManagement', friendlyname: 'Care Management', version: tabId === 1 ? '1.22.0.45' : '1.22.0.44', ismanaged: false },
                    { solutionid: id(2), uniquename: 'OtherSolution', friendlyname: 'Other Solution', version: '1.0.0.0', ismanaged: true }
                ] };
                if (request.action === 'getSolutionComponents') response = fixture.failAnalysis ? { success: false, status: 500 } : {
                    success: true, components: [
                        { componenttype: 1, objectid: id(20) }, { componenttype: 2, objectid: id(21) },
                        { componenttype: 60, objectid: id(22) }, { componenttype: 26, objectid: id(23) }
                    ]
                };
                if (request.action === 'getSolutionDependencies') response = fixture.failSource ? { success: false, status: 403 } : {
                    success: true, dependencies: [{ requiredcomponentobjectid: id(30), requiredcomponenttype: 1, dependentcomponentobjectid: id(21), dependentcomponenttype: 2, dependencytype: 2 }]
                };
                if (request.action === 'getSolutionExplorerData') response = { success: true, workflows: [], forms: [], views: [], webResources: [], choices: [], environmentVariables: [], connectionReferences: [], pluginAssemblies: [], pluginTypes: [], pluginSteps: [] };
                if (request.action === 'resolveDependencyIdentities') response = { success: true, dependencies: request.dependencies.map(item => ({ ...item, identity: { kind: 'table', logicalName: 'account', displayName: 'Account' }, identityKey: 'table:account' })) };
                if (request.action === 'getTargetPreflightSnapshot') response = { success: true, components: [{ componentType: 1, objectId: id(30), providers: [{ uniqueName: 'CareManagement', friendlyName: 'Care Management', isManaged: false }] }] };
                if (request.action === 'getTargetPreflightSnapshot' && fixture.targetOutcome !== 'verified') {
                    response = { success: true, components: [], semanticMatches: {
                        matches: [], checkedIdentityKeys: fixture.targetOutcome === 'missing' ? ['table:account'] : [],
                        safeMissingIdentityKeys: fixture.targetOutcome === 'missing' ? ['table:account'] : []
                    } };
                }
                if (fixture.pendingAnalysis && request.action === 'getSolutionComponents' && tabId === 1) {
                    fixture.completeAnalysis = () => callback(response);
                    return;
                }
                const delay = request.action === 'getReleaseDiffSnapshot' ? fixture.delayDiff : tabId !== 1 ? fixture.delayTarget : 0;
                setTimeout(() => callback(response), delay);
            }
        }
    };
}
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const server = http.createServer((request, response) => {
        const name = new URL(request.url, 'http://localhost').pathname.slice(1);
        if(name==='snapshot-fixture.html'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Snapshot fixture</title>');return;}
        if (!['sidepanel.html', 'sidepanel.js', 'workflow.js', 'styles.css', 'workflow.css', 'release-diff.js', 'release-diff-ui.js', 'release-diff-review.js', 'content.js', 'release-diff-content.js'].includes(name)) { response.writeHead(404).end(); return; }
        response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
        response.end(fs.readFileSync(path.join(__dirname, '../DataverseReleaseGuardian', name)));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const page = await browser.newPage({ viewport: { width: 360, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(mockChrome);
        const open = async () => {
            await page.goto(`http://127.0.0.1:${server.address().port}/sidepanel.html`);
            await page.waitForFunction(() => document.getElementById('rgFlowConnection')?.textContent.includes('choose a solution'));
            await page.locator('#rg26Splash').click();
            await page.waitForFunction(() => document.getElementById('rg26Splash').style.display === 'none');
        };
        const analyse = async () => {
            await page.selectOption('#solutionSelect', guid(1));
            await page.click('#analyzeSolutionButton');
            await page.waitForFunction(() => document.body.dataset.analysisState === 'complete' && rgWorkflow.sourceReady);
        };
        await open();
        await page.screenshot({ path: '/tmp/guardian-setup.png', fullPage: true });
        assert.equal(await page.locator('#rgScreenHome').isVisible(), true);
        assert.equal(await page.locator('#whoAmIButton').isVisible(), false);
        assert.equal(await page.locator('#loadSolutionsButton').isVisible(), false);
        assert.equal(await page.locator('[data-rg-screen="readiness"]').isDisabled(), true);
        await page.selectOption('#solutionSelect', guid(1));
        await page.evaluate(() => fixture.pendingAnalysis = true);
        await page.click('#analyzeSolutionButton');
        await page.waitForFunction(() => !!fixture.completeAnalysis);
        assert.equal(await page.locator('#rgScreenSolution').isVisible(), true);
        assert.equal(await page.locator('#solutionSelect').isDisabled(), true);
        assert.equal(await page.locator('#rgFlowExplore').isDisabled(), true);
        await page.evaluate(() => { fixture.pendingAnalysis = false; fixture.completeAnalysis(); });
        await page.waitForFunction(() => document.body.dataset.analysisState === 'complete' && rgWorkflow.sourceReady);
        assert.equal(await page.locator('#totalComponents').innerText(), '4');
        assert.equal(await page.locator('#rg26Splash').isVisible(), false);
        await page.screenshot({ path: '/tmp/guardian-overview.png', fullPage: true });
        await page.click('#rgFlowExplore');
        await page.waitForSelector('.rg27-explorer-card');
        assert.equal(await page.locator('.rg27-explorer-hero').isVisible(), false);
        assert.equal(await page.locator('.rg27-explorer-card').count(), 10);
        await page.screenshot({ path: '/tmp/guardian-explore.png', fullPage: true });
        const duplicateIds = await page.evaluate(() => {
            const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
            return ids.filter((id, index) => ids.indexOf(id) !== index);
        });
        assert.deepEqual(duplicateIds, []);
        await page.click('[data-rg-screen="readiness"]');
        assert.equal(await page.locator('#rgFlowReadinessTitle').innerText(), 'Target not checked');
        await page.locator('#rgFlowSourceDetails > summary').click();
        assert.equal(await page.locator('#rgReadinessScore').isVisible(), false);
        assert.equal(await page.locator('#rgReadinessStatus').isVisible(), false);
        await page.locator('[data-rg-dependency-filter="external"]').click();
        assert.ok((await page.locator('#rgDependencyList').innerText()).includes('Account') || !(await page.locator('#rgDependencyList').innerText()).includes('No prerequisites'));
        await page.locator('#rgFlowSourceDetails > summary').click();
        await page.screenshot({ path: '/tmp/guardian-readiness.png', fullPage: true });
        await page.selectOption('#rg28TargetTabSelect', '2');
        await page.waitForFunction(() => document.getElementById('rg282TargetSolutionSelect').disabled === false && !document.getElementById('rg28RunPreflight').disabled);
        assert.equal(await page.locator('#rg282TargetSolutionSelect').inputValue(), guid(3));
        // Opening another tab must not redirect source API operations to the target.
        await page.evaluate(() => fixture.activeTab = 2);
        await page.click('#rg28RunPreflight');
        await page.waitForFunction(() => document.body.dataset.targetChecked === 'true');
        assert.equal(await page.locator('#rgFlowReadinessTitle').textContent(), 'Target check complete');
        assert.equal(await page.locator('#rgReadinessStatus').textContent(), 'READY');
        assert.equal(await page.locator('#rgFlowSourceDetails').isVisible(), false);
        assert.equal(await page.locator('#rgFlowFindingsSlot #rgDependencyList').count(), 1);
        assert.equal(await page.locator('.rg282-score-ring').isVisible(), false);
        assert.ok(await page.evaluate(() => fixture.calls.filter(call => ['resolveDependencyIdentities', 'getSolutionExplorerData'].includes(call.action)).every(call => call.tabId === 1)));
        await page.evaluate(() => window.scrollTo(0,0));
        await page.screenshot({ path: '/tmp/guardian-result.png', fullPage: true });
        // Release Diff has independent results and never changes the readiness verdict.
        const readinessBefore=await page.evaluate(()=>JSON.stringify(rg28LastComparison));
        await page.click('[data-rg-screen="diff"]');
        await page.click('#rgReleaseRun');
        await page.waitForFunction(()=>!!rgReleaseDiffUI.result);
        assert.equal(await page.locator('[data-release-filter="matched"] strong').innerText(),'5');
        assert.equal(await page.locator('[data-release-filter="changed"] strong').innerText(),'2');
        assert.equal(await page.locator('[data-release-filter="sourceOnly"] strong').innerText(),'1');
        assert.equal(await page.locator('[data-release-filter="targetOnly"] strong').innerText(),'1');
        assert.equal(await page.locator('[data-release-filter="notCompared"] strong').innerText(),'1');
        const direction=await page.locator('#rgReleaseDirection').innerText();
        assert.ok(direction.includes('dev.crm.dynamics.com · v1.22.0.45 → uat.crm.dynamics.com · v1.22.0.44'));
        assert.equal(await page.evaluate(()=>JSON.stringify(rg28LastComparison)),readinessBefore);
        await page.locator('.rg-release-row > summary').first().click();
        assert.ok((await page.locator('.rg-release-row-body').first().innerText()).includes('MaxLength'));
        assert.ok((await page.locator('.rg-release-row-body').first().innerText()).includes('Target: 200'));
        for(const filter of ['matched','sourceOnly','targetOnly','notCompared','changed']) {
            await page.click(`[data-release-filter="${filter}"]`);
            assert.ok(await page.locator('.rg-release-row').count()>0);
        }
        // Review-scale fixture: 669 changed, 7,914 matched, 1,320 not compared.
        const releaseCallsBefore=await page.evaluate(()=>fixture.calls.filter(call=>call.action==='getReleaseDiffSnapshot').length);
        await page.evaluate(()=>{
            window.originalReleaseResult=rgReleaseDiffUI.result;
            const make=(i,state,changes=[])=>({state,changes,source:{id:`review-${i}`,name:`Change ${i}`,family:'column',table:'account',membership:'explicit',definition:{complete:true,missing:[],fingerprints:{},previews:{}}},
                target:{id:`target-${i}`,name:`Change ${i}`,family:'column',table:'account',membership:'explicit',definition:{complete:true,missing:[],fingerprints:{},previews:{}}}});
            const changed=Array.from({length:669},(_,i)=>{
                const fields=i<100?['Description']:i<300?['MaxLength']:i<500?['FormXML']:['Display name','FetchXML'];
                const value=make(i,'changed',fields);
                if(i>=300&&i<500){value.source.family='form';value.source.table='contact';}
                if(i>=500){value.source.family='view';value.source.table='incident';}
                value.target.family=value.source.family;value.target.table=value.source.table;
                for(const field of fields){value.source.definition.previews[field]=field==='Description'?'[{"language":1033,"text":"Source description"}]':'Source value';value.target.definition.previews[field]=field==='Description'?'[{"language":1033,"text":"Target description"}]':'Target value';}
                return value;
            });
            const gaps=Array.from({length:1320},(_,i)=>{
                const value=make(10000+i,'notCompared');value.source.name=`Gap ${i}`;value.target.name=value.source.name;
                const code=i<400?'table_shell':i<700?'unsupported_type':i<900?'metadata_unavailable':null;
                value.source.family=i<400?'table':i>=1220?'view':'column';value.target.family=value.source.family;
                value.source.table=i<400?'account':i<700?'contact':i<900?'incident':i<1220?'account':'';value.target.table=value.source.table;
                value.source.definition={complete:false,missing:['Missing property'],issues:code?[{code}]:[]};value.target.definition={...value.source.definition};
                if(i>=1220)delete value.target;
                return value;
            });
            rgReleaseDiffUI.result={changed,matched:[...changed,...Array.from({length:7245},(_,i)=>make(20000+i,'same'))],sourceOnly:[],targetOnly:[],notCompared:gaps};
            rgReleaseDiffUI.filter='notCompared';rgReleaseDiffUI.resetReview();rgReleaseDiffUI.render();
        });
        assert.equal(await page.locator('[data-release-filter="notCompared"] strong').innerText(),'1320');
        const reasonTotal=await page.locator('[data-review-reason] strong').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.textContent),0));
        assert.equal(reasonTotal,1320);
        assert.equal(await page.locator('.rg-release-row').count(),25);
        await page.click('[data-review-reason="tableShell"]');
        assert.ok((await page.locator('#rgReleaseShowing').innerText()).includes('of 400 matching'));
        assert.ok((await page.locator('.rg-release-summary').innerText()).includes('intentionally not compared'));
        await page.selectOption('#rgReleaseTable','account');
        await page.selectOption('#rgReleaseFamily','table');
        await page.click('#rgReleaseSearch');await page.keyboard.type('Gap 10');
        assert.equal(await page.locator('#rgReleaseSearch').inputValue(),'Gap 10');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'rgReleaseSearch');
        assert.equal(await page.locator('.rg-release-row').count(),11);
        await page.click('#rgReleaseClear');
        assert.ok((await page.locator('#rgReleaseShowing').innerText()).includes('of 1320 matching'));
        await page.setViewportSize({width:700,height:900});await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:'/tmp/guardian-release-coverage-review.png',fullPage:true});
        await page.click('[data-release-filter="changed"]');
        assert.equal(await page.locator('[data-review-kind="descriptionOnly"] strong').innerText(),'100');
        assert.equal(await page.locator('[data-review-kind="settings"] strong').innerText(),'200');
        assert.equal(await page.locator('[data-review-kind="xml"] strong').innerText(),'200');
        assert.equal(await page.locator('[data-review-kind="mixed"] strong').innerText(),'169');
        await page.click('[data-review-kind="descriptionOnly"]');
        await page.selectOption('#rgReleaseTable','account');await page.selectOption('#rgReleaseFamily','column');
        await page.selectOption('#rgReleaseProperty','Description');await page.selectOption('#rgReleaseGroup','property');
        assert.ok((await page.locator('#rgReleaseShowing').innerText()).includes('of 100 matching'));
        await page.click('#rgReleaseSearch');await page.keyboard.type('Change 10');
        assert.equal(await page.locator('.rg-release-row').count(),1);
        await page.locator('.rg-release-row > summary').click();
        const description=await page.locator('.rg-release-row-body').innerText();
        assert.ok(description.includes('Language 1033: Source description'));assert.equal(description.includes('[{"language"'),false);
        await page.click('#rgReleaseClear');await page.selectOption('#rgReleaseGroup','family');
        await page.selectOption('#rgReleaseProperty','FormXML');
        assert.ok((await page.locator('#rgReleaseShowing').innerText()).includes('of 200 matching'));
        assert.equal((await page.locator('.rg-release-group > summary strong').first().innerText()),'form');
        await page.click('#rgReleaseMore');assert.equal(await page.locator('.rg-release-row').count(),50);
        await page.selectOption('#rgReleaseGroup','property');
        assert.equal((await page.locator('.rg-release-group > summary strong').first().innerText()),'FormXML');
        for(const width of [320,420,700]){
            await page.setViewportSize({width,height:900});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Review controls overflow at ${width}px`);
        }
        await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/guardian-release-change-review.png',fullPage:true});
        await page.fill('#rgReleaseSearch','nothing-matches');assert.equal(await page.locator('.rg-release-row').count(),0);
        await page.click('#rgReleaseClear');
        assert.equal(await page.evaluate(()=>fixture.calls.filter(call=>call.action==='getReleaseDiffSnapshot').length),releaseCallsBefore);
        assert.equal(await page.evaluate(()=>JSON.stringify(rg28LastComparison)),readinessBefore);
        await page.evaluate(()=>{rgReleaseDiffUI.result=window.originalReleaseResult;delete window.originalReleaseResult;rgReleaseDiffUI.filter='changed';rgReleaseDiffUI.resetReview();rgReleaseDiffUI.render();});

        // Real browser XML canonicalization, not a fixture hash.
        const xmlChecks=await page.evaluate(async()=>{
            const def=value=>RGReleaseDiff.definition({FormXML:value},['FormXML'],['FormXML']);
            const a=await def('<form b="2" a="1"><cell name="x" /></form>');
            const b=await def('<form a="1" b="2">\n<!-- formatting --><cell name="x"/></form>');
            const c=await def('<form a="1" b="2"><cell name="y"/></form>');
            const invalid=await def('<form>');
            return {same:a.fingerprints.FormXML===b.fingerprints.FormXML,changed:a.fingerprints.FormXML!==c.fingerprints.FormXML,incomplete:!invalid.complete};
        });
        assert.deepEqual(xmlChecks,{same:true,changed:true,incomplete:true});
        for(const width of [320,420,700]) {
            await page.setViewportSize({width,height:900});
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Release Diff overflows at ${width}px`);
        }
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:'/tmp/guardian-release-diff.png',fullPage:true});
        await page.evaluate(()=>fixture.failDiff=true);
        await page.click('#rgReleaseRun');
        await page.waitForFunction(()=>document.getElementById('rgReleaseStatus').textContent.includes('Target snapshot denied'));
        assert.equal(await page.locator('#rgReleaseResults').isVisible(),false);
        assert.equal(await page.evaluate(()=>JSON.stringify(rg28LastComparison)),readinessBefore);
        await page.evaluate(()=>{fixture.failDiff=false;fixture.delayDiff=200;});
        await page.click('#rgReleaseRun');
        await page.click('#rgReleaseChooseTarget');
        await page.locator('#rgFlowTargetSetup > summary').click();
        await page.selectOption('#rg28TargetTabSelect','3');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(()=>rgReleaseDiffUI.result),null);
        assert.equal(await page.locator('#rgReleaseResults').isVisible(),false);
        await page.evaluate(()=>fixture.delayDiff=0);
        await page.selectOption('#rg28TargetTabSelect','2');
        await page.waitForFunction(()=>!document.getElementById('rg28RunPreflight').disabled);
        await page.click('#rg28RunPreflight');
        await page.waitForFunction(()=>document.body.dataset.targetChecked==='true');
        await page.setViewportSize({width:360,height:900});
        // Display real finding states; a confirmed missing prerequisite is still 100% checked.
        await page.locator('#rgFlowTargetSetup > summary').click();
        await page.evaluate(() => fixture.targetOutcome = 'missing');
        await page.click('#rg28RunPreflight');
        await page.waitForFunction(() => document.body.dataset.targetChecked === 'true');
        assert.equal(await page.locator('#rgReadinessStatus').textContent(), 'BLOCKED');
        assert.equal(await page.locator('.rg282-score-ring strong').textContent(), '100%');
        await page.locator('#rgFlowTargetSetup > summary').click();
        await page.evaluate(() => fixture.targetOutcome = 'unknown');
        await page.click('#rg28RunPreflight');
        await page.waitForFunction(() => document.body.dataset.targetChecked === 'true');
        assert.equal(await page.locator('#rgReadinessStatus').textContent(), 'REVIEW');
        assert.equal((await page.locator('.rg28-verdict').innerText()).trim(), 'REVIEW');
        assert.equal(await page.locator('.rg282-score-ring strong').textContent(), '0%');
        // Reproduce the reported 344/335/9 case, including unrecognized component types.
        await page.evaluate(() => {
            const id = n => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
            rg28LastComparison = {
                verdict: 'WARNING', total: 344,
                sameSolution: Array.from({ length: 335 }, (_, i) => ({ componentType: 1, objectId: id(i), identity: { displayName: `Verified table ${i}` } })),
                otherSolutions: [], managedBase: [], semanticMatches: [], confirmedMissing: [], configWarnings: [],
                needsVerification: Array.from({ length: 9 }, (_, i) => ({ componentType: 10078 + i, objectId: id(1000+i),
                    requiredBy: i === 0 ? { identity: { name: 'Get Referral Closure KPIs' } } : null,
                    verificationReason: 'A stable identity could not be resolved.' }))
            };
            rg282RenderDependencyComparison(rg28LastComparison);
            rg282ApplyTargetReadinessToMainPanel(rg28LastComparison);
            rgRenderReadinessDependencies();
        });
        assert.equal(await page.locator('.rg282-human-dependency').count(), 9);
        assert.equal(await page.locator('#rgFlowFindingsSlot #rgDependencyList').count(), 1);
        assert.equal(await page.locator('#rgFlowSourceDetails').isVisible(), false);
        assert.equal(await page.locator('.rg-flow-readiness-guide').isVisible(), false);
        assert.equal(await page.locator('.rg282-result-title h3').innerText(), '9 prerequisites need manual review');
        assert.equal(await page.locator('[data-rg-dependency-filter="external"]').innerText(), 'Not verified (9)');
        assert.equal(await page.locator('.rg282-analysis-details').getAttribute('open'), null);
        assert.equal(await page.locator('#rg282NeedsVerification .rg282-human-dependency').count(), 0);
        assert.equal(await page.locator('.rg-flow-finding[open]').count(), 0);
        await page.locator('.rg-flow-finding > summary').first().click();
        assert.ok((await page.locator('.rg-flow-finding-body').first().innerText()).includes('not proof that it is missing'));
        await page.locator('.rg282-technical-details > summary').first().click();
        assert.ok((await page.locator('.rg282-technical-details').first().innerText()).includes('10078'));
        await page.locator('.rg-flow-finding > summary').first().click();
        await page.setViewportSize({ width: 700, height: 900 });
        await page.evaluate(() => window.scrollTo(0,0));
        await page.screenshot({ path: '/tmp/guardian-readiness-review.png', fullPage: true });
        for (const width of [320, 420, 700]) {
            await page.setViewportSize({ width, height: 900 });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Review result overflows at ${width}px`);
        }
        await page.locator('[data-rg-dependency-filter="managed"]').click();
        assert.equal(await page.locator('.rg282-human-dependency').count(), 25);
        await page.locator('.rg-flow-more-findings').click();
        assert.equal(await page.locator('.rg282-human-dependency').count(), 50);
        while (await page.locator('.rg-flow-more-findings').count()) await page.locator('.rg-flow-more-findings').click();
        assert.equal(await page.locator('.rg282-human-dependency').count(), 335);
        await page.locator('[data-rg-dependency-filter="external"]').click();
        assert.equal(await page.locator('.rg282-human-dependency').count(), 9);
        await page.locator('[data-rg-dependency-filter="blocking"]').click();
        assert.equal(await page.locator('.rg282-human-dependency').count(), 0);
        assert.ok((await page.locator('#rgDependencyList').innerText()).includes('No prerequisites'));
        // Runtime-resolved names do not imply target verification by themselves.
        await page.evaluate(() => {
            const unresolved = rg28LastComparison.needsVerification[0];
            unresolved.identity = { kind: 'runtimeRecord', displayName: 'Case routing rule', tableLogicalName: 'custom_rule', componentTypeLabel: 'Routing rules', confirmMissingSafe: false };
            unresolved.verificationReason = 'The source record ID was not found, and no matching active unique key is available in the target.';
            rg282RenderDependencyComparison(rg28LastComparison);
        });
        await page.locator('.rg-flow-finding > summary').first().click();
        assert.ok((await page.locator('.rg-flow-finding').first().innerText()).includes('Case routing rule'));
        assert.ok((await page.locator('.rg-flow-finding').first().innerText()).includes('Routing rules'));
        assert.ok((await page.locator('.rg-flow-finding').first().innerText()).includes('no matching active unique key'));
        assert.equal(await page.locator('[data-rg-dependency-filter="external"]').innerText(), 'Not verified (9)');
        await page.setViewportSize({ width: 360, height: 900 });
        await page.locator('#rgFlowTargetSetup > summary').click();
        await page.selectOption('#rg28TargetTabSelect', '3');
        assert.equal(await page.locator('#rg28ComparisonResults').isVisible(), false);
        assert.equal(await page.locator('body').getAttribute('data-target-checked'), 'false');
        // A target connection failure exposes a clear retry, and retry recovers.
        await page.evaluate(() => fixture.failTarget = true);
        await page.selectOption('#rg28TargetTabSelect', '2');
        await page.waitForFunction(() => document.body.classList.contains('rg-flow-target-error'));
        assert.equal(await page.locator('#rg28VerifyTarget').isVisible(), true);
        await page.evaluate(() => fixture.failTarget = false);
        await page.click('#rg28VerifyTarget');
        await page.waitForFunction(() => !document.getElementById('rg282TargetSolutionSelect').disabled);
        // An older target callback cannot populate the new target selector.
        await page.evaluate(() => fixture.delayTarget = 200);
        await page.selectOption('#rg28TargetTabSelect', '3');
        await page.selectOption('#rg28TargetTabSelect', '');
        await page.waitForTimeout(450);
        assert.equal(await page.locator('#rg282TargetSolutionSelect').isDisabled(), true);
        assert.equal(await page.locator('#rg28RunPreflight').isDisabled(), true);
        // Evidence switcher avoids showing duplicate lists at the same time.
        await page.evaluate(() => {
            rgShowScreen('explorer');
            document.getElementById('columnInspector').style.display = 'block';
        });
        assert.equal(await page.locator('#rgFlowUsagePanel').isVisible(), true);
        assert.equal(await page.locator('#rgFlowGraphPanel').isVisible(), false);
        await page.click('#rgFlowGraphTab');
        assert.equal(await page.locator('#rgFlowUsagePanel').isVisible(), false);
        assert.equal(await page.locator('#rgFlowGraphPanel').isVisible(), true);
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#rgFlowUsageTab').getAttribute('aria-selected'), 'true');
        // Changing solutions invalidates old overview and target evidence.
        await page.click('[data-rg-screen="home"]');
        await page.selectOption('#solutionSelect', guid(2));
        assert.equal(await page.locator('[data-rg-screen="readiness"]').isDisabled(), true);
        assert.equal(await page.locator('body').getAttribute('data-target-checked'), 'false');
        await page.evaluate(() => fixture.failAnalysis = true);
        await page.click('#analyzeSolutionButton');
        await page.waitForFunction(() => document.body.dataset.analysisState === 'error');
        assert.equal(await page.locator('#rgFlowExplore').isDisabled(), true);
        await page.click('#rgFlowChangeSolution');
        assert.equal(await page.locator('#rgScreenHome').isVisible(), true);
        await page.evaluate(() => { fixture.failAnalysis = false; fixture.failSource = true; });
        await page.selectOption('#solutionSelect', guid(1));
        await page.click('#analyzeSolutionButton');
        await page.waitForFunction(() => document.body.dataset.analysisState === 'complete');
        await page.click('#rgFlowReadiness');
        await page.selectOption('#rg28TargetTabSelect', '2');
        await page.waitForTimeout(550);
        assert.equal(await page.locator('#rg28RunPreflight').isDisabled(), true);
        assert.equal(await page.locator('body').getAttribute('data-target-checked'), 'false');
        assert.equal(await page.locator('#rgFlowRetrySource').isVisible(), true);
        await page.evaluate(() => fixture.failSource = false);
        await page.click('#rgFlowRetrySource');
        await page.waitForFunction(() => rgWorkflow.sourceReady);
        assert.equal(await page.locator('#rgFlowRetrySource').isVisible(), false);
        // Connection errors clear the old selection and have a working retry.
        await page.click('[data-rg-screen="home"]');
        await page.evaluate(() => { fixture.activeTab = 1; fixture.failConnection = true; });
        await page.click('#rgFlowConnect');
        await page.waitForFunction(() => document.getElementById('rgFlowConnect').textContent === 'Retry connection');
        assert.equal(await page.locator('#solutionSelect').isDisabled(), true);
        assert.equal(await page.locator('[data-rg-screen="readiness"]').isDisabled(), true);
        await page.evaluate(() => fixture.failConnection = false);
        await page.click('#rgFlowConnect');
        await page.waitForFunction(() => !rgWorkflow.connecting && loadedSolutions.length === 2);
        await analyse();
        // Layout checks at representative narrow and wide panel sizes.
        for (const width of [320, 420, 700]) {
            await page.setViewportSize({ width, height: 900 });
            for (const screen of ['home', 'solution', 'explorer', 'diff', 'readiness']) {
                await page.evaluate(screen => rgShowScreen(screen), screen);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen} overflows at ${width}px`);
            }
        }
        // Exercise the actual collector, metadata extensions, XML parser and hashes together.
        const snapshotPage=await browser.newPage();
        await snapshotPage.addInitScript(mockChrome);
        await snapshotPage.goto(`http://127.0.0.1:${server.address().port}/snapshot-fixture.html`);
        for(const name of ['release-diff.js','content.js','release-diff-content.js']) await snapshotPage.addScriptTag({url:`http://127.0.0.1:${server.address().port}/${name}`});
        const snapshotResult=await snapshotPage.evaluate(async()=>{
            let target=false;
            const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
            const labels=text=>({LocalizedLabels:[{LanguageCode:1033,Label:text}]});
            dataverseFetch=async address=>{
                const endpoint=new URL(address).pathname.split('/api/data/v9.2/')[1];
                const tableId=id(target?101:1),columnId=id(target?102:2),formId=id(target?103:3);
                if(endpoint==='solutioncomponents')return {value:[{componenttype:1,objectid:tableId,rootcomponentbehavior:1},{componenttype:2,objectid:columnId},{componenttype:60,objectid:formId},{componenttype:26,objectid:id(4)}]};
                if(endpoint.startsWith('solutions('))return {solutionid:id(target?200:100),friendlyname:'Package',uniquename:'package',version:target?'1.0.0.1':'1.0.0.2'};
                if(endpoint==='EntityDefinitions')return {value:[{MetadataId:tableId,LogicalName:'account',SchemaName:'Account',DisplayName:labels('Account'),Description:labels('Description'),OwnershipType:'UserOwned',PrimaryIdAttribute:'accountid',PrimaryNameAttribute:'name',IsActivity:false,IsAuditEnabled:{Value:target}}]};
                if(endpoint.endsWith('/Attributes'))return {value:[{MetadataId:columnId,LogicalName:'name',SchemaName:'Name',DisplayName:labels('Name'),Description:labels('Description'),AttributeType:'String',AttributeTypeName:{Value:'StringType'},RequiredLevel:{Value:'None'},IsAuditEnabled:{Value:false},IsValidForAdvancedFind:{Value:true}}]};
                if(endpoint.endsWith('StringAttributeMetadata'))return {value:[{MetadataId:columnId,MaxLength:target?200:100,Format:'Text'}]};
                if(endpoint==='systemforms')return {value:[{formid:formId,name:'Main',uniquename:'account_main',type:2,objecttypecode:'account',formxml:`<form><control datafieldname="${target?'accountnumber':'name'}"/></form>`,componentstate:0}]};
                if(endpoint==='savedqueries')return {value:[{savedqueryid:id(4),name:'Active',returnedtypecode:'account',querytype:0,fetchxml:`<fetch><entity name="account"><attribute name="${target?'accountnumber':'name'}"/></entity></fetch>`,layoutxml:'<grid/>',columnsetxml:null,isdefault:false,isquickfindquery:false,componentstate:0}]};
                return {value:[]};
            };
            const source=await getReleaseDiffSnapshot({solutionId:id(100)});target=true;
            const destination=await getReleaseDiffSnapshot({solutionId:id(200)});
            const result=RGReleaseDiff.compare(source,destination);
            return {sourceSuccess:source.success,targetSuccess:destination.success,matched:result.matched.length,changed:result.changed.length,notCompared:result.notCompared.length,
                fields:result.changed.flatMap(row=>row.changes),allDefinitionsComplete:source.components.every(row=>row.definition.complete)&&destination.components.every(row=>row.definition.complete)};
        });
        assert.equal(snapshotResult.sourceSuccess,true);assert.equal(snapshotResult.targetSuccess,true);
        assert.equal(snapshotResult.allDefinitionsComplete,true);
        assert.equal(snapshotResult.matched,4);assert.equal(snapshotResult.changed,4);assert.equal(snapshotResult.notCompared,0);
        for(const field of ['Auditing','MaxLength','FormXML','FetchXML'])assert.ok(snapshotResult.fields.includes(field),field);
        await snapshotPage.close();
        assert.deepEqual(errors, []);
        console.log('PASS: automatic setup; analysis loading/success/failure and navigation; explorer; source/target distinction; target auto-connect, retry, stale callbacks and source-tab pinning; evidence tabs; solution reset; source failure; 320/420/700px layouts; splash preservation; no browser errors.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
