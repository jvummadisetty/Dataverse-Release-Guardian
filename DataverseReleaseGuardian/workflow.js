// Guided presentation and navigation. Dataverse calculations remain in sidepanel.js.
const rgWorkflow = {
    analyzedId: null,
    analysisVersion: 0,
    contextRevision: 0,
    connecting: false,
    analyzing: false,
    targetBusy: false,
    sourceReady: false,
    sourceCheckState: "pending",
    sourceTabId: null,
    initialized: false,
    element(id) { return document.getElementById(id); },
    text(id, value) {
        const element = this.element(id);
        if (element && element.textContent !== String(value)) element.textContent = value;
    },
    initialize() {
        if (this.initialized) return;
        this.initialized = true;
        document.body.classList.add('rg-workflow');
        document.body.dataset.analysisState = 'empty';
        document.body.dataset.targetChecked = 'false';
        this.buildHome();
        this.buildOverview();
        this.buildReadiness();
        this.buildInspector();
        const labels = { home: 'Setup', solution: 'Overview', explorer: 'Explore', readiness: 'Readiness' };
        document.querySelectorAll('.rg-nav-button').forEach(button => {
            button.type = 'button';
            button.textContent = labels[button.dataset.rgScreen];
            button.setAttribute('aria-controls', {
                home: 'rgScreenHome', solution: 'rgScreenSolution',
                explorer: 'rgScreenExplorer', readiness: 'rgScreenReadiness'
            }[button.dataset.rgScreen]);
        });
        this.element('rgAppNavigation').setAttribute('aria-label', 'Release analysis');
        this.element('solutionSelect').setAttribute('aria-label', 'Source solution');
        this.element('solutionSelect').addEventListener('change', () => this.refreshContext());
        this.refreshContext();
        this.connect();
    },
    heading(screen, title, description) {
        const node = this.element(screen)?.querySelector('.rg-screen-header');
        if (!node) return;
        node.querySelector('h2').textContent = title;
        node.querySelector('p').textContent = description;
        node.querySelector('h2').tabIndex = -1;
    },
    buildHome() {
        this.heading('rgScreenHome', 'Start with a solution', 'Your current Dynamics session connects securely. Choose the solution you want to review.');
        const screen = this.element('rgScreenHome');
        const environment = this.element('detectButton').closest('.card');
        const connection = this.element('whoAmIButton').closest('.card');
        const solutions = this.element('loadSolutionsButton').closest('.card');
        solutions.classList.add('rg-flow-solutions');
        solutions.querySelector('h2').textContent = 'Choose a solution';
        const intro = document.createElement('section');
        intro.className = 'rg-flow-session';
        intro.innerHTML = `<div><span class="rg-flow-eyebrow">SOURCE ENVIRONMENT</span>
            <strong id="rgFlowHost">Detecting environment…</strong>
            <p id="rgFlowConnection" role="status" aria-live="polite">Connecting to Dataverse…</p></div>
            <button id="rgFlowConnect" type="button" class="secondary-button">Refresh connection</button>`;
        screen.querySelector('.rg-screen-header').after(intro);
        intro.querySelector('button').addEventListener('click', () => this.connect());
        const diagnostics = document.createElement('details');
        diagnostics.className = 'rg-flow-diagnostics';
        diagnostics.innerHTML = '<summary>Connection details &amp; troubleshooting</summary>';
        diagnostics.append(environment, connection);
        const reload = document.createElement('div');
        reload.className = 'rg-flow-diagnostic-actions';
        reload.append(this.element('loadSolutionsButton'));
        diagnostics.append(reload);
        screen.append(diagnostics);
        const label = document.createElement('label');
        label.htmlFor = 'solutionSelect';
        label.textContent = 'Solution';
        this.element('solutionSelect').before(label);
        this.element('analyzeSolutionButton').textContent = 'Analyse solution →';
        this.element('solutionStatus').setAttribute('role', 'status');
        this.element('solutionStatus').setAttribute('aria-live', 'polite');
    },
    buildOverview() {
        this.heading('rgScreenSolution', 'Solution overview', 'Review the package, then explore its components or check a target environment.');
        const card = document.createElement('section');
        card.className = 'rg-flow-overview';
        card.innerHTML = `<span class="rg-flow-eyebrow">SELECTED SOLUTION</span>
            <h3 id="rgFlowSolutionName">Choose a solution</h3>
            <p id="rgFlowSolutionVersion"></p>
            <div class="rg-flow-actions">
                <button id="rgFlowExplore" class="primary-button" type="button">Explore components →</button>
                <button id="rgFlowReadiness" class="secondary-button" type="button">Check target readiness</button>
            </div><button id="rgFlowChangeSolution" class="rg-flow-link" type="button">Change solution</button>`;
        this.element('rgScreenSolution').querySelector('.rg-screen-header').after(card);
        this.element('rgFlowExplore').addEventListener('click', () => rg27ShowExplorerHome());
        this.element('rgFlowReadiness').addEventListener('click', () => rgShowScreen('readiness'));
        this.element('rgFlowChangeSolution').addEventListener('click', () => rgShowScreen('home'));
        this.element('analysisStatus').setAttribute('role', 'status');
        this.element('analysisStatus').setAttribute('aria-live', 'polite');
        this.element('analysisCard').querySelector('h2').textContent = 'Package inventory';
        this.heading('rgScreenExplorer', 'Explore components', 'Choose a component type to inspect names, usage and dependencies.');
    },
    compactOverview() {
        const platform = this.element('rg25PlatformComponents');
        if (platform && !this.element('rgFlowPlatformDetails')) {
            const details = document.createElement('details');
            details.id = 'rgFlowPlatformDetails';
            details.className = 'rg-flow-disclosure';
            details.innerHTML = '<summary>Deployment component shortcuts</summary>';
            platform.before(details);
            details.append(platform);
        }
        document.querySelectorAll('#analysisCard .rg-navigable-summary').forEach(card => {
            if (card.tagName === 'BUTTON' || card.dataset.flowKeyboard) return;
            card.dataset.flowKeyboard = 'true';
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                card.click();
            });
        });
    },
    buildReadiness() {
        this.heading('rgScreenReadiness', 'Check deployment readiness', 'Verify prerequisites in the destination environment before deployment.');
        rg28CreateTargetComparisonPanel();
        const screen = this.element('rgScreenReadiness');
        const guide = document.createElement('section');
        guide.className = 'rg-flow-readiness-guide';
        guide.innerHTML = `<span class="rg-flow-eyebrow">TARGET VERIFICATION</span>
            <h3 id="rgFlowReadinessTitle">Target not checked</h3>
            <p id="rgFlowReadinessDescription">Open your destination environment in another Dynamics tab, then select it below.</p>
            <p id="rgFlowPrerequisiteCount" class="rg-flow-note" role="status"></p>
            <button id="rgFlowRetrySource" type="button" class="secondary-button" hidden>Retry source analysis</button>
            <ol class="rg-flow-steps" aria-label="Target verification steps">
                <li id="rgFlowStepTarget">Select environment</li>
                <li id="rgFlowStepSolution">Choose solution</li>
                <li id="rgFlowStepCheck">Run target check</li>
            </ol>`;
        screen.querySelector('.rg-screen-header').after(guide);
        this.element('rgFlowRetrySource').addEventListener('click', () => {
            this.sourceCheckState = 'pending';
            this.readinessUpdated();
            rgAnalyzeSolutionReadiness();
        });
        const target = this.element('rg28TargetPanel');
        target.querySelector('h2').textContent = 'Destination environment';
        target.querySelector('.rg28-panel-header p').textContent = 'Connection is verified automatically when you select a target tab.';
        this.element('rg28RefreshTargets').textContent = 'Refresh tabs';
        this.element('rg28VerifyTarget').textContent = 'Retry target connection';
        this.element('rg28RunPreflight').textContent = 'Run target check';
        this.element('rg28TargetStatus').setAttribute('role', 'status');
        this.element('rg28TargetStatus').setAttribute('aria-live', 'polite');
        const setup = document.createElement('details');
        setup.id = 'rgFlowTargetSetup';
        setup.className = 'rg-flow-target-setup';
        setup.open = true;
        setup.innerHTML = '<summary id="rgFlowTargetSetupLabel">Choose destination</summary>';
        target.prepend(setup);
        ['.rg28-panel-header', '.rg282-source-target-grid', '#rg28RunPreflight', '#rg28TargetStatus']
            .forEach(selector => setup.append(target.querySelector(selector)));
        const source = target.querySelector('.rg282-environment-card');
        const sourceDisclosure = document.createElement('details');
        sourceDisclosure.className = 'rg-flow-source-details';
        sourceDisclosure.innerHTML = '<summary>Source solution</summary>';
        source.before(sourceDisclosure);
        sourceDisclosure.append(source);
        const packageDetails = document.createElement('details');
        packageDetails.className = 'rg-flow-disclosure';
        packageDetails.innerHTML = '<summary>Package inventory comparison — separate from readiness</summary>';
        this.element('rg282SolutionComparison').before(packageDetails);
        packageDetails.append(this.element('rg282SolutionComparison'));
        packageDetails.hidden = true;
        packageDetails.id = 'rgFlowPackageDetails';
        // Target findings precede package counts; package equality is a separate question.
        packageDetails.before(this.element('rg28ComparisonResults'));
        const records = document.createElement('details');
        records.className = 'rg-flow-disclosure';
        records.innerHTML = '<summary>Prerequisite records &amp; source analysis</summary>';
        records.id = 'rgFlowSourceDetails';
        screen.append(records);
        records.append(this.element('rgReadinessPanel'));
        this.element('rgReadinessPanel').querySelector('h2').textContent = 'Prerequisite records';
        this.findingsSection = this.element('rgDependencyList').closest('.rg-readiness-section');
        this.findingsAnchor = document.createComment('Single prerequisite list home');
        this.findingsSection.before(this.findingsAnchor);
        this.findingsSection.querySelector('h3').textContent = 'Prerequisites';

    },
    placeFindings(comparison) {
        if (!this.findingsSection) return;
        const slot = this.element('rgFlowFindingsSlot');
        if (comparison && slot) slot.append(this.findingsSection);
        else if (this.findingsAnchor?.parentNode) this.findingsAnchor.after(this.findingsSection);
        if (this.element('rgFlowSourceDetails')) this.element('rgFlowSourceDetails').hidden = !!comparison;
    },
    buildInspector() {
        const inspector = this.element('columnInspector');
        const graph = this.element('rgColumnDependencyPanel');
        const references = [...inspector.children].find(node => node.tagName === 'H3' && node.textContent.trim() === 'Definition References');
        if (!references || !graph) return;
        const tabs = document.createElement('div');
        tabs.className = 'rg-flow-evidence-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Column evidence');
        tabs.innerHTML = `<button id="rgFlowUsageTab" type="button" role="tab" aria-controls="rgFlowUsagePanel" aria-selected="true">Definition references</button>
            <button id="rgFlowGraphTab" type="button" role="tab" aria-controls="rgFlowGraphPanel" aria-selected="false" tabindex="-1">Dataverse graph</button>`;
        references.before(tabs);
        const usage = document.createElement('section');
        usage.id = 'rgFlowUsagePanel';
        usage.setAttribute('role', 'tabpanel');
        usage.setAttribute('aria-labelledby', 'rgFlowUsageTab');
        const nodes = [];
        for (let node = references; node && node !== graph; node = node.nextElementSibling) nodes.push(node);
        tabs.after(usage);
        nodes.forEach(node => usage.append(node));
        const graphPanel = document.createElement('section');
        graphPanel.id = 'rgFlowGraphPanel';
        graphPanel.setAttribute('role', 'tabpanel');
        graphPanel.setAttribute('aria-labelledby', 'rgFlowGraphTab');
        graphPanel.hidden = true;
        usage.after(graphPanel);
        graphPanel.innerHTML = '<p class="rg-flow-note">Dataverse-reported dependencies are separate evidence. A component may also appear in definition references; these counts are not added together.</p>';
        graphPanel.append(graph);
        const buttons = [...tabs.querySelectorAll('button')];
        const selectTab = index => {
            [usage, graphPanel].forEach((panel, i) => panel.hidden = i !== index);
            buttons.forEach((button, i) => {
                button.setAttribute('aria-selected', String(i === index));
                button.tabIndex = i === index ? 0 : -1;
            });
        };
        buttons.forEach((button, index) => {
            button.addEventListener('click', () => selectTab(index));
            button.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
                selectTab(next);
                buttons[next].focus();
            });
        });
    },
    async connect() {
        if (this.connecting || this.analyzing) return;
        this.connecting = true;
        this.resetAnalysis();
        resetSolutionState();
        this.element('solutionSelect').innerHTML = '<option value="">Select a solution</option>';
        this.element('rgFlowConnect').disabled = true;
        this.element('solutionSelect').disabled = true;
        this.text('rgFlowConnection', 'Connecting to your active Dynamics tab…');
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.sourceTabId = tab?.id || null;
            await detectEnvironment();
            this.text('rgFlowHost', this.element('environmentHost').textContent);
            if (!await testDataverseConnection()) throw new Error(this.element('connectionStatus').textContent);
            this.text('rgFlowConnection', 'Connected. Loading solutions…');
            if (!await loadSolutions()) throw new Error(this.element('solutionStatus').textContent);
            this.text('rgFlowConnection', loadedSolutions.length ? 'Connected · choose a solution below' : 'Connected · no visible solutions found');
            this.text('rgFlowConnect', 'Refresh connection');
        } catch (error) {
            this.text('rgFlowConnection', `Open a signed-in Dynamics tab and retry. ${error.message}`);
            this.text('rgFlowConnect', 'Retry connection');
        } finally {
            this.connecting = false;
            this.element('rgFlowConnect').disabled = false;
            this.element('solutionSelect').disabled = !loadedSolutions.length;
            this.refreshContext();
        }
    },
    canOpen(screen) { return screen === 'home' || this.analyzing && screen === 'solution' || !!this.analyzedId; },
    analysisStarted(id) {
        this.analysisVersion++;
        this.invalidateTarget();
        this.analyzing = true;
        this.analyzedId = null;
        this.sourceReady = false;
        this.sourceCheckState = 'pending';
        document.body.dataset.analysisState = 'loading';
        this.element('analyzeSolutionButton').disabled = true;
        this.element('solutionSelect').disabled = true;
        this.element('rgFlowConnect').disabled = true;
        this.text('rgFlowSolutionName', rg282GetSourceSolution()?.friendlyname || 'Analysing solution…');
        this.refreshContext();
        rgShowScreen('solution');
    },
    analysisFinished(id, success) {
        this.analyzing = false;
        this.analyzedId = success ? id : null;
        document.body.dataset.analysisState = success ? 'complete' : 'error';
        this.element('analyzeSolutionButton').disabled = false;
        this.element('solutionSelect').disabled = false;
        this.element('rgFlowConnect').disabled = false;
        this.refreshContext();
    },
    resetAnalysis() {
        this.analysisVersion++;
        this.analyzedId = null;
        this.sourceReady = false;
        this.sourceCheckState = 'pending';
        this.analyzing = false;
        document.body.dataset.analysisState = 'empty';
        this.invalidateTarget();
        this.refreshContext();
    },
    refreshContext() {
        const source = rg282GetSourceSolution();
        this.text('rgFlowSolutionName', source?.friendlyname || source?.uniquename || 'Choose a solution');
        this.text('rgFlowSolutionVersion', source ? `Version ${source.version || '—'} · ${source.ismanaged ? 'Managed' : 'Unmanaged'}` : '');
        document.querySelectorAll('.rg-nav-button').forEach(button => {
            button.disabled = !this.canOpen(button.dataset.rgScreen);
            button.title = button.disabled ? 'Analyse a solution to continue' : '';
        });
        for (const id of ['rgFlowExplore', 'rgFlowReadiness']) {
            if (this.element(id)) this.element(id).disabled = !this.analyzedId;
        }
        this.readinessUpdated();
    },
    screenChanged(screen) {
        document.querySelectorAll('.rg-nav-button').forEach(button => {
            if (button.dataset.rgScreen === screen) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        const title = document.querySelector(`.rg-screen[data-screen="${screen}"] .rg-screen-header h2`);
        title?.focus({ preventScroll: true });
        if (screen === 'readiness') this.readinessUpdated();
    },
    contextKey() {
        return `${rg282GetSourceSolution()?.solutionid}:${rg28TargetTabId}:${rg28TargetSolutionId}:${this.contextRevision}`;
    },
    invalidateTarget() {
        this.contextRevision++;
        rg28LastComparison = null;
        this.targetBusy = false;
        rgUniqueMissingComponents = rgUniqueMissingComponents.map(item => ({ ...item, targetStatus: undefined }));
        for (const id of ['rg28ComparisonResults', 'rg282SolutionComparison']) {
            if (this.element(id)) this.element(id).style.display = 'none';
        }
        if (this.element('rgFlowPackageDetails')) this.element('rgFlowPackageDetails').hidden = true;
        if (this.sourceReady) {
            this.text('rgDependencyStatus', `${rgUniqueMissingComponents.length} source prerequisites await target verification.`);
            this.text('rgReadinessRecommendation', 'Source analysis alone does not confirm target readiness. Run a target check to verify prerequisites.');
            rgRenderReadinessDependencies();
        }
        this.readinessUpdated();
    },
    targetChanged() {
        this.invalidateTarget();
        document.body.classList.remove('rg-flow-target-error');
        if (rg28TargetTabId) rg28VerifyTargetAndLoadSolutions();
        else rg28SetStatus('Open your destination in another Dynamics tab, then refresh tabs.');
    },
    targetStatus(message, tone) {
        this.targetBusy = tone === 'loading';
        document.body.classList.toggle('rg-flow-target-error', tone === 'warning');
        const retry = this.element('rg28VerifyTarget');
        if (retry) retry.disabled = !rg28TargetTabId || this.targetBusy;
        this.readinessUpdated();
    },
    sourceChecked(success) {
        this.sourceReady = success;
        this.sourceCheckState = success ? 'complete' : 'failed';
        this.readinessUpdated();
    },
    readinessUpdated() {
        if (!this.initialized) return;
        const comparison = rg28LastComparison;
        if (document.body.dataset.targetChecked !== String(!!comparison)) {
            const setup = this.element('rgFlowTargetSetup');
            if (setup) setup.open = !comparison;
        }
        document.body.dataset.targetChecked = String(!!comparison);
        this.placeFindings(comparison);
        const guide = document.querySelector('.rg-flow-readiness-guide');
        if (guide) guide.hidden = !!comparison;
        const heading = this.element('rgScreenReadiness')?.querySelector('.rg-screen-header');
        if (heading) {
            heading.querySelector('h2').textContent = 'Deployment readiness';
            heading.querySelector('p').textContent = comparison
                ? `${rg282GetSourceSolution()?.friendlyname || 'Source solution'} → ${this.element('rg28TargetTabSelect')?.selectedOptions[0]?.textContent || 'Target'}`
                : 'Choose a destination to verify prerequisites before deployment.';
        }

        this.text('rgFlowTargetSetupLabel', comparison
            ? `Destination: ${this.element('rg28TargetTabSelect')?.selectedOptions[0]?.textContent || 'Target'}`
            : 'Choose destination');
        this.text('rgFlowReadinessTitle', comparison ? 'Target check complete' : this.targetBusy ? 'Checking target…' : 'Target not checked');
        this.text('rgFlowReadinessDescription', comparison
            ? 'Review the verified findings below. Package counts are available separately.'
            : 'Source analysis alone does not verify deployment readiness. Select a destination to check its prerequisites.');
        this.text('rgFlowPrerequisiteCount', this.analyzedId
            ? comparison ? `${comparison.total || 0} prerequisite records checked against the target.`
                : this.sourceReady ? `${rgUniqueMissingComponents.length} source prerequisites awaiting target verification.` : this.sourceCheckState === 'failed' ? 'Source prerequisites could not be loaded. Retry before running a target check.' : 'Loading source prerequisites…'
            : 'Analyse a source solution to begin.');
        if (this.element('rgFlowRetrySource')) this.element('rgFlowRetrySource').hidden = this.sourceCheckState !== 'failed';
        const steps = [!!rg28TargetTabId, !!rg28TargetSolutionId, !!comparison];
        ['rgFlowStepTarget', 'rgFlowStepSolution', 'rgFlowStepCheck'].forEach((id, index) => {
            const element = this.element(id);
            if (!element) return;
            element.classList.toggle('is-complete', steps[index]);
            if (index === steps.findIndex(done => !done)) element.setAttribute('aria-current', 'step');
            else element.removeAttribute('aria-current');
        });
        if (this.element('rgFlowPackageDetails')) this.element('rgFlowPackageDetails').hidden = !comparison;
        if (this.element('rgReadinessPanel')) this.element('rgReadinessPanel').style.display = this.analyzedId ? 'block' : 'none';
        if (this.element('rg28RunPreflight')) {
            rg282UpdateCompareButton();
            this.element('rg28RunPreflight').disabled ||= this.targetBusy || !this.sourceReady;
        }
    }
};
