// Read only the opening condition statement. Later examples, failed attempts and
// work-up conditions must never be merged into its reagent/temperature fields.
const cache = new WeakMap();
const unique = xs => [...new Set(xs.filter(Boolean))];
const join = xs => unique(xs).join(' / ');
const tidy = s => String(s || '').replace(/\s+/g, ' ').trim();
const number = '[−–-]?\\d+(?:\\.\\d+)?';
const range = `${number}(?:\\s*[–−-]\\s*${number})?`;
const temperatureRE = new RegExp(`(?:[~≈<>≤≥]\\s*)?${range}\\s*°\\s*[CF]\\b|\\b(?:room temperature|ambient temperature|r\\.\\s*t\\.?|rt|reflux|boiling|ice bath|heat)\\b`, 'gi');
const timeUnit = '(?:seconds?|secs?|s|minutes?|mins?|min|hours?|hrs?|hr|h|days?|d|weeks?)';
const timeRE = new RegExp(`(?:[~≈<>≤≥□]\\s*)?${range}\\s*${timeUnit}\\b(?:\\s+to\\s+${range}\\s*${timeUnit}\\b)?|\\bovernight\\b`, 'gi');
const yieldRE = new RegExp(`(?:[~≈<>≤≥□]\\s*)?${range}\\s*%(?:\\s*,\\s*${range}\\s*%)*\\s*(?:(?:isolated|overall|combined|chemical)\\s+)?yield(?:s)?|\\b(?:quantitative|excellent|good|high|moderate|low)\\s+yield(?:s)?`, 'gi');
const otherRE = new RegExp(`(?:${range}\\s*(?:atm|bar|psi|Torr|mm\\s*Hg|nm)\\b)|\\b(?:electrolysis|under vacuum|high vacuum|microwave(?: irradiation)?|irradiation|photolysis|ultrasound|sonication)\\b|hν`, 'gi');
// Match a whole component: water in a hydrate and ether in BF3·Et2O are reagents,
// not separate solvent assignments. Pyridine/AcOH/TFA retain their ambiguous role.
const solventRE = /^(?:(?:aq\.?|aqueous|dry|anhydrous|abs\.?|absolute|wet|boiling|refluxing|degassed)\s+)*(?:THF|2-MeTHF|DMF|DMSO|DMAc|NMP|HMPA|DMPU|DME|CH2Cl2|CHCl3|CH3CN|MeCN|C6H6|PhH|PhMe|C6H5CH3|CCl4|CS2|CH3OH|C2H5OH|MeOH|EtOH|Et2O|EtOAc|AcOEt|H2O|D2O|CDCl3|CD3CN|CD3OD|CD2Cl2|C6D6|DMSO-d6|dioxane|1,4-dioxane|dichloromethane|dichloroethane|1,2-dichloroethane|DCE|chloroform|carbon tetrachloride|acetonitrile|dimethylformamide|dimethyl sulfoxide|dimethylsulfoxide|dimethylacetamide|tetrahydrofuran|diethyl ether|ether|petroleum ether|hexanes?|heptanes?|pentanes?|cyclohexane|benzene|toluene|xylene|xylenes|acetone|2-butanone|butanone|ethyl acetate|methyl acetate|methanol|ethanol|isopropyl alcohol|isopropanol|2-propanol|n-propanol|propanol|IPA|i-PrOH|n-PrOH|t-BuOH|tert-butanol|tert-butyl alcohol|n-BuOH|butanol|water|organic solvent|solvent-free|no solvent|neat)(?:\s*\([^)]*\))?$/i;
const wordsRE = /\b(?:is|are|was|were|has|have|can|could|will|would|should|gives?|gave|affords?|afforded|used|using|reacts?|reacted|allows?|increases?|decreases?|results?|shows?|shown|reported|found|cleaves?|cleaved|removes?|removed|protects?|silylates?|formed|formation|preparation|converted|mixing|treat|treatment|stable|stability|inert|resistant|resists?|withstands?|tolerates?|unaffected|unsuccessful|decomposes?|decomposition)\b/i;

export function firstStatement(text) {
 const s = tidy(text).replace(/\byields? (?=(?:This|These|The|An?|It)\s)/g, m=>m.trim()+'. ');
 let depth = 0;
 for (let i = 0; i < s.length; i++) {
  if ('(['.includes(s[i])) depth++;
  if (')]'.includes(s[i])) depth = Math.max(0, depth - 1);
  if (s[i] !== '.' || depth || (i + 1 < s.length && !/\s/.test(s[i + 1]))) continue;
  const word = s.slice(0, i).match(/([A-Za-z]+)$/)?.[1]?.toLowerCase();
  if (['aq','cat','catal','conc','concd','sat','satur','anhyd','equiv','eq','mol','vol','wt','abs','approx','ca','e','g','i','r'].includes(word)) continue;
  return s.slice(0, i + 1).trim();
 }
 return s;
}
function splitOutside(s, separators) {
 let depth = 0, last = 0; const parts = [];
 for (let i = 0; i < s.length; i++) {
  if ('(['.includes(s[i])) depth++;
  if (')]'.includes(s[i])) depth = Math.max(0, depth - 1);
  if (!depth && separators.includes(s[i]) && !(s[i]===','&&/\d/.test(s[i-1]||'')&&/\d/.test(s[i+1]||''))) { parts.push(s.slice(last, i).trim()); last = i + 1; }
 }
 parts.push(s.slice(last).trim()); return parts.filter(Boolean);
}
const matches = (s, re) => [...s.matchAll(new RegExp(re.source, re.flags))].map(m => m[0]);
const temperature = s => s.replace(/^(?:rt|r\.\s*t\.?|room temperature|ambient temperature)$/i,'室温').replace(/^reflux$/i,'還流').replace(/^heat$/i,'加熱（温度記載なし）').replace(/\s*°\s*/g,' °');
const time = s => s.replace(/\b(hours?|hrs?|hr)\b/gi,'h').replace(/\b(minutes?|mins?)\b/gi,'min').replace(/\b(seconds?|secs?)\b/gi,'s').replace(/\b(days?)\b/gi,'d').replace(/overnight/gi,'一晩').replace(/(\d)(?=[a-z])/gi,'$1 ');
function solventPart(s) {
 const parts = s.replace(/\.$/,'').replace(/^\d+(?:\.\d+)?%\s*/,'').split(/\s+or\s+|\s*\/\s*|\s*–\s*(?=[A-Z])|\s*:\s*(?=[A-Za-z])/);
 return parts.every(p => solventRE.test(p.trim()) || /^(?:CH3NO2|MeNO2|nitromethane|ClCH2CH2Cl)$/i.test(p.trim()));
}
function parseStep(text) {
 const full = text.replace(/\.$/,'').trim();
 const context = full.match(/^((?:From|For)\s+[^:]+):\s*/i)?.[0] || '';
 const s = context ? full.slice(context.length) : full;
 const temperatures = matches(s,temperatureRE), times = matches(s,timeRE), yields = matches(s,yieldRE), other = matches(s,otherRE);
 const reagents = [], solvents = [], unassigned = [];
 const components = splitOutside(s, ',');
 const narrative = wordsRE.test(s) || /^(?:The|This|These|Those|An?|Although|When|If)\s/i.test(s) || /\b(?:works?|occurs?|exhibits?)\b/i.test(s) || (components.length === 1 && s.split(' ').length > 12);
 if (!narrative) for (const part of components) {
  let rest = part;
  for (const re of [temperatureRE,timeRE,yieldRE,otherRE]) rest = rest.replace(re,'');
  rest = rest.replace(/\(\s*\)/g,'').replace(/^[\s,;:]+|[\s,;:]+$/g,'').trim();
  if (!rest || /^(?:at|for|to|heat to|under|then|in)$/i.test(rest)) continue;
  if (solventPart(rest)) solvents.push(rest);
  else if (rest.includes('/') && rest.split('/').some(solventPart)) {
   for(const p of rest.split('/')) (solventPart(p)?solvents:reagents).push(p.trim());
  }
  else if (rest.includes(' or ') && rest.split(' or ').some(solventPart)) unassigned.push(part);
  else if (/^\(?\d+\s*:\s*\d+/.test(rest) && solvents.length) solvents[solvents.length-1] += ' ('+rest.replace(/^\(|\)$/g,'')+')';
  else if (/\bfor\s+|^(?:respectively|or|and|with|in|from)\b/i.test(rest) || /^\d+(?:[–−-]\d+)?%\s*(?:or|and)?$/.test(rest)) unassigned.push(part);
  else if (!wordsRE.test(rest) && rest.split(' ').length <= 12 && !/^\d+\s*%$/.test(rest)) reagents.push(rest);
  else unassigned.push(part);
 }
 else unassigned.push(s);
 return {reagents:unique(reagents).join(', '),solvent:join(solvents),temperature:narrative?'':join(temperatures.map(temperature)),time:narrative?'':join(times.map(time)),yield:narrative?'':join(yields.map(x=>x.replace(/\s*yield(?:s)?$/i,''))),other:narrative?'':join(other),unassigned,narrative,original:s,context};
}

// Explicit readings for narrative passages. These are factual summaries of the
// supplied book, not invented defaults; different examples stay separate.
const readings = {
 bm39:{lead:'NaI / MOMCl',steps:[{reagents:'MOMCl, NaI',solvent:'',temperature:'',time:'',yield:''}],note:'NaIによりMOMIを系内で生成。第三級アルコールへの導入を促進する記載。'},
 bm3817:{steps:[{reagents:'(Boc)2O',solvent:'THF',temperature:'約40 °C',time:'',yield:''}],note:'単純なアミンへの導入。bis-Boc化、尿素副生、別法、余剰試薬の分解条件は原文に別途記載。'},
 bm3753:{steps:[{reagents:'TMSTFA',solvent:'',temperature:'',time:'',yield:''},{reagents:'Fmoc-OSu',solvent:'',temperature:'',time:'',yield:''},{reagents:'MeOH',solvent:'',temperature:'',time:'',yield:''}],note:'アミノ酸をシリル化 → Fmoc化 → MeOHでシリル基を除去。'},
 bm4531:{steps:[{reagents:'TsCl, pyridine または Et3N',solvent:'CH2Cl2（例示）',temperature:'',time:'',yield:''}],note:'アミンとTsClを酸捕捉剤存在下で反応。Schotten–Baumann法も原文に記載。'},
 bm66:{steps:[{reagents:'PPTS（pyridinium p-toluenesulfonate）',solvent:'t-BuOH または 2-butanone',temperature:'還流',time:'',yield:'80–99%'}],note:'別の適用例：PPTS / t-BuOH、84 °C、8 h、45%（PMB共存下）。条件を主例と混合していません。'}
};

export function conditionData(method) {
 const text = tidy(method.text);
 const old = cache.get(method); if (old?.text === text) return old.result;
 const lead = firstStatement(text);
 const reading = text ? readings[method.id] : null;
 const steps = reading ? reading.steps.map(s=>({...s,other:'',unassigned:[],narrative:false})) : splitOutside(lead.replace(/\.$/,'').replace(/,\s*then\s+/gi,';'),';→').map(parseStep);
 if (!reading && (lead.includes('→') || /,\s*then\s+/i.test(lead))) for(let i=1;i<steps.length;i++) {
  if(!steps[i].reagents&&!steps[i].narrative) steps[i].reagents='前段から継続';
  if(!steps[i].solvent&&steps[i-1].solvent) steps[i].solvent='前段と同じ';
 }
 const result = {lead,steps,reading:!!reading,note:reading?.note||'',hasText:!!text,uncertain:steps.some(s=>s.narrative||s.unassigned.length),hasMore:!!text&&text.length>lead.length,unreadable:/□|�/.test(lead)};
 cache.set(method,{text,result}); return result;
}
export function renderConditions(method, esc) {
 const c = conditionData(method);
 const missing = c.hasText && !c.uncertain ? '条件文に記載なし' : '原文・図を確認';
 const field = (name,value,cls='') => `<div class="reaction-field ${cls}"><dt>${name}</dt><dd class="${value?'':'not-stated'}">${value?esc(value):missing}</dd></div>`;
 const steps = c.steps.length ? c.steps : [{reagents:'',solvent:'',temperature:'',time:'',yield:'',other:''}];
 return `<div class="reaction-conditions">${steps.map((s,i)=>`<section class="reaction-step" aria-label="反応条件${steps.length>1?'・操作'+(i+1):''}">${steps.length>1?`<div class="reaction-step-label">${i+1}<span>${i===0?'操作':'続いて'}</span></div>`:''}<dl class="reaction-main">${field('試薬・触媒・添加剤',s.reagents,'reagent-field')}${field('溶媒・反応媒体',s.solvent)}</dl><dl class="reaction-metrics">${field('温度',s.temperature)}${field('時間',s.time)}${field('収率',s.yield)}</dl>${s.context?`<div class="reaction-other">${esc(s.context.replace(/:\s*$/,''))}</div>`:''}${s.other?`<div class="reaction-other"><strong>その他の条件</strong> ${esc(s.other)}</div>`:''}</section>`).join('<div class="reaction-next" aria-hidden="true">↓</div>')}${c.note?`<p class="reaction-caption">${esc(c.note)}</p>`:''}${c.uncertain?`<p class="reaction-original" lang="en">${esc(c.lead)}</p><p class="reaction-caption">説明・複数の条件を含む記載です。特定できない欄は原文・図で確認してください。</p>`:''}${c.unreadable?'<p class="reaction-caption">□を含む文字は判読未確定です。原書画像を確認してください。</p>':''}${!c.hasText?'<p class="reaction-caption">図中の反応条件・構造式は、原書画像で確認できます。</p>':''}</div>`;
}
export function conditionColumns(method) {
 const c=conditionData(method), fields=['reagents','solvent','temperature','time','yield','other'];
 return fields.map(k=>c.steps.map((s,i)=>(c.steps.length>1?`${i+1}) `:'')+(s[k]||'原文・図を確認')).join(' → '));
}
