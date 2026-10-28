// Shared, dependency-free comparison rules for live solution definitions.
const RGReleaseDiff = (() => {
    const stable = value => JSON.stringify(sort(value));
    function sort(value) {
        if (Array.isArray(value)) return value.map(sort);
        if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
        return value;
    }
    function xml(value) {
        if (typeof value !== 'string' || !value.trim()) throw new Error('XML definition unavailable');
        const doc = new DOMParser().parseFromString(value, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid XML definition');
        function visit(node) {
            if (node.nodeType === 1) return [node.namespaceURI || '', node.localName,
                [...node.attributes].filter(attr => attr.namespaceURI !== 'http://www.w3.org/2000/xmlns/')
                    .map(attr => [attr.namespaceURI || '', attr.localName, attr.value]).sort((a,b) => stable(a).localeCompare(stable(b))),
                [...node.childNodes].map(visit).filter(value => value !== null)];
            if ([3,4].includes(node.nodeType) && node.nodeValue.trim()) return node.nodeValue;
            return null; // Formatting whitespace, comments, declarations.
        }
        return visit(doc.documentElement);
    }
    async function definition(values, required, xmlFields = []) {
        const fingerprints = {}, previews = {}, missing = [];
        for (const field of required) {
            if (!(field in values) || values[field] === undefined) { missing.push(field); continue; }
            try {
                const value = xmlFields.includes(field) ? xml(values[field]) : values[field];
                const bytes = new TextEncoder().encode(stable(value));
                const hash = await crypto.subtle.digest('SHA-256', bytes);
                fingerprints[field] = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2,'0')).join('');
                previews[field] = xmlFields.includes(field) ? 'XML definition' : (typeof value === 'string' ? value : stable(value)).slice(0,180);
            } catch (_) { missing.push(field); }
        }
        return { complete: missing.length === 0, fingerprints, previews, missing };
    }
    function compare(source, target) {
        const result = { matched: [], changed: [], sourceOnly: [], targetOnly: [], notCompared: [] };
        const left = source.components || [], right = target.components || [];
        const usedLeft = new Set(), usedRight = new Set();
        const bucket = (rows, selector) => {
            const map = new Map();
            rows.forEach((row,index) => { const key = selector(row); if (key) { if (!map.has(key)) map.set(key,[]); map.get(key).push(index); } });
            return map;
        };
        const leftKeys = bucket(left, row => row.key), rightKeys = bucket(right, row => row.key);
        const leftIds = bucket(left, row => row.id ? `${row.family}:${row.id.toLowerCase()}` : null);
        const rightIds = bucket(right, row => row.id ? `${row.family}:${row.id.toLowerCase()}` : null);
        function pair(a,b,method) {
            usedLeft.add(a); usedRight.add(b);
            const s=left[a], t=right[b], sd=s.definition, td=t.definition;
            const fields = [...new Set([...Object.keys(sd?.fingerprints || {}), ...Object.keys(td?.fingerprints || {})])].sort();
            const complete = fields.length > 0 && sd?.complete && td?.complete;
            const changes = complete ? fields.filter(field => sd.fingerprints[field] !== td.fingerprints[field]) : [];
            const row = { source:s, target:t, method, changes, state: complete ? changes.length ? 'changed' : 'same' : 'notCompared',
                reason: complete ? '' : 'Identity matched; one or both covered definitions were incomplete. Equality was not established.' };
            result.matched.push(row);
            if (row.state === 'changed') result.changed.push(row);
            if (row.state === 'notCompared') result.notCompared.push(row);
        }
        left.forEach((row,a) => {
            if (!row.key || leftKeys.get(row.key).length !== 1 || rightKeys.get(row.key)?.length !== 1) return;
            pair(a,rightKeys.get(row.key)[0],'Stable metadata identity');
        });
        left.forEach((row,a) => {
            if (usedLeft.has(a) || !row.id) return;
            const id = `${row.family}:${row.id.toLowerCase()}`, candidates=rightIds.get(id);
            if (leftIds.get(id)?.length !== 1 || candidates?.length !== 1 || usedRight.has(candidates[0])) return;
            const b=candidates[0], other=right[b];
            if (row.key && other.key && row.key !== other.key) return;
            if (row.key && leftKeys.get(row.key)?.length > 1 || other.key && rightKeys.get(other.key)?.length > 1) return;
            pair(a,b,'Preserved component ID');
        });
        function unmatched(rows, other, used, opposite, side) {
            rows.forEach((row,index) => {
                if (used.has(index)) return;
                const ownKeys=side==='source'?leftKeys:rightKeys, otherKeys=side==='source'?rightKeys:leftKeys;
                const uncertain = !row.key || ownKeys.get(row.key)?.length > 1 || otherKeys.get(row.key)?.length > 1 ||
                    opposite.coverage?.[row.family] !== true || other.some(item => item.family === row.family && (!item.key ||
                        row.id && item.id && row.id.toLowerCase() === item.id.toLowerCase() || row.alias && item.alias === row.alias && item.key !== row.key));
                const entry={ [side]:row, state:uncertain?'notCompared':side==='source'?'sourceOnly':'targetOnly',
                    reason: uncertain ? 'Identity or opposite-side inventory is incomplete or ambiguous; package absence was not established.'
                        : `Packaged only in the selected ${side} solution. This does not prove environment-wide absence or predict an import deletion.` };
                result[entry.state].push(entry);
            });
        }
        unmatched(left,right,usedLeft,target,'source'); unmatched(right,left,usedRight,source,'target');
        return result;
    }
    return { stable, definition, compare, xml };
})();
