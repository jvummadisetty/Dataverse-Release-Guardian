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
    window.fixture = { activeTab: 1, calls: [], failConnection: false, failAnalysis: false, failSource: false, failTarget: false, delayTarget: 0, pendingAnalysis: false, targetOutcome: "verified" };
    window.chrome = {
        runtime: { lastError: null },
        tabs: {
            query: async query => query.active ? [tabs.find(tab => tab.id === fixture.activeTab)] : tabs,
            get: async tabId => tabs.find(tab => tab.id === tabId),
            sendMessage: (tabId, request, callback) => {
                fixture.calls.push({ tabId, ...request });
                let response = { success: true };
                if (request.action === 'whoAmI') response = fixture.failConnection || tabId !== 1 && fixture.failTarget
                    ? { success: false, status: 403 } : { success: true, data: { UserId: id(10), OrganizationId: id(11) } };
                if (request.action === 'getSolutions') response = { success: true, solutions: [
                    { solutionid: id(tabId === 1 ? 1 : 3), uniquename: 'CareManagement', friendlyname: 'Care Management', version: '1.22.0.45', ismanaged: false },
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
                const delay = tabId !== 1 ? fixture.delayTarget : 0;
                setTimeout(() => callback(response), delay);
            }
        }
    };
}
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const server = http.createServer((request, response) => {
        const name = new URL(request.url, 'http://localhost').pathname.slice(1);
        if (!['sidepanel.html', 'sidepanel.js', 'workflow.js', 'styles.css', 'workflow.css'].includes(name)) { response.writeHead(404).end(); return; }
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
            for (const screen of ['home', 'solution', 'explorer', 'readiness']) {
                await page.evaluate(screen => rgShowScreen(screen), screen);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen} overflows at ${width}px`);
            }
        }
        assert.deepEqual(errors, []);
        console.log('PASS: automatic setup; analysis loading/success/failure and navigation; explorer; source/target distinction; target auto-connect, retry, stale callbacks and source-tab pinning; evidence tabs; solution reset; source failure; 320/420/700px layouts; splash preservation; no browser errors.');
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
