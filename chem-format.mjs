// Typography only: never change the source formula, infer a missing bond, or
// repair a PDF glyph. Formula counts, charge, and leading coefficients differ.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const atoms = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og D T'.split(' ');
const groups = 'TBDMS TBDPS TIPS TMS TES TBS Fmoc Alloc Teoc Cbz Boc BOC OAc OMe OEt OBn OPh OTs OMs OTf NMe NEt NPr NBu Me Et Pr Bu Ph Bn Bz Ac Ms Ts Tf Tr Ar R'.split(' ');
const units = [...new Set([...atoms, ...groups])].sort((a,b)=>b.length-a.length);
const monatomicCations = new Set('Li Na K Rb Cs Mg Ca Sr Ba Al Sc Ti V Cr Mn Fe Co Ni Cu Zn Zr Ag Cd Sn La Ce Hg Pb Bi'.split(' '));

function bodyHTML(body) {
 let i = 0, count = 0;
 function sequence(close='') {
  let out='', seen=false;
  while(i<body.length && (!close || body[i]!==close)) {
   const ch=body[i];
   if(ch==='(' || ch==='[') {
    const end=ch==='('?')':']'; i++;
    const inside=sequence(end);
    if(!inside || body[i]!==end) return null;
    i++; out+=ch+inside+end; seen=true;
   } else {
    const unit=units.find(u=>body.startsWith(u,i));
    if(!unit) return null;
    i+=unit.length; out+=escapeHTML(unit); seen=true; count++;
   }
   const digits=body.slice(i).match(/^\d+/)?.[0];
   if(digits){out+=`<sub>${digits}</sub>`;i+=digits.length;}
   if(/^[=≡#]$/.test(body[i]||'')){out+=escapeHTML(body[i++]);if(i===body.length)return null;}
  }
  return seen?out:null;
 }
 const html=sequence();
 return html && i===body.length ? {html,count} : null;
}

function moleculeHTML(raw) {
 let s=raw, lead='', charge='', isotope='', prefix='';
 const alkyl=s.match(/^(i|n|s|t|sec|tert|o|m|p)-/);
 if(alkyl){prefix=`<i>${alkyl[1]}</i>-`;s=s.slice(alkyl[0].length);}
 const iso=s.match(/^\^(\d+)(?=[A-Z])/);
 if(iso){isotope=`<sup>${iso[1]}</sup>`;s=s.slice(iso[0].length);}
 const explicit=s.match(/\^(\d*[+−-])$/);
 if(explicit){charge=explicit[1];s=s.slice(0,-explicit[0].length);}
 else {
  const single=s.match(/^([A-Z][a-z]?)(\d+)([+−-])$/);
  const complex=s.match(/^(.*\])(\d+)([+−-])$/);
  if(single && single[3]==='+' && monatomicCations.has(single[1])){s=single[1];charge=single[2]+single[3];}
  else if(complex){s=complex[1];charge=complex[2]+complex[3];}
  else if(/[+−-]$/.test(s)){charge=s.slice(-1);s=s.slice(0,-1);}
 }
 // The 5 in CuSO4·5H2O is a stoichiometric coefficient, not an atom count.
 const coefficient=s.match(/^\d+(?=[A-Z(\[])/);
 if(coefficient){lead=coefficient[0];s=s.slice(lead.length);}
 const parsed=bodyHTML(s);
 if(!parsed) return null;
 const result=prefix+isotope+lead+parsed.html+(charge?`<sup>${charge.replace(/-/g,'−')}</sup>`:'');
 return result;
}

function tokenHTML(token) {
 const original=escapeHTML(token);
 let html=moleculeHTML(token);
 // Retain explicit adduct dots and bonds; do not guess □ or missing charges.
 if(!html && /[·•–-]/.test(token)) {
  const parts=token.split(/([·•–-])/), formatted=parts.map((p,i)=>i%2?escapeHTML(p):moleculeHTML(p));
  if(formatted.every(x=>x!==null))html=formatted.join('');
 }
 if(!html || html===original)return original;
 return `<span class="chem-formula">${html}</span>`;
}

export function formatChemistry(text) {
 const s=String(text??''); let out='', last=0;
 // A complete token must parse. Numbers in 25 °C, 1.5 h, 6 M, 20%, 1,2-
 // names, and identifiers are consequently not reformatted as formula counts.
 for(const match of s.matchAll(/[A-Za-z0-9^()[\]·•+−–=#-]+/g)) {
  out+=escapeHTML(s.slice(last,match.index))+tokenHTML(match[0]);last=match.index+match[0].length;
 }
 return out+escapeHTML(s.slice(last));
}

export function watchChemicalTypography(root) {
 const skip='script,style,textarea,input,select,option,code,pre,svg,math,.chem-formula,[contenteditable="true"]';
 function decorate(start) {
  if(!start || !root.contains(start))return;
  const texts=[];
  if(start.nodeType===3)texts.push(start);
  else {
   if(start.nodeType!==1||start.closest(skip))return;
   const walker=document.createTreeWalker(start,NodeFilter.SHOW_TEXT);
   while(walker.nextNode())texts.push(walker.currentNode);
  }
  for(const text of texts) {
   if(!text.parentElement||text.parentElement.closest(skip)||!/[A-Za-z][0-9]|\)[0-9]|\][0-9]|\^[0-9]|[A-Za-z][+−-]/.test(text.data))continue;
   const html=formatChemistry(text.data);
   if(!html.includes('class="chem-formula"'))continue;
   const template=document.createElement('template');template.innerHTML=html;
   text.replaceWith(template.content);
  }
 }
 const observer=new MutationObserver(records=>{
  for(const record of records)if(record.type==='characterData')decorate(record.target);else for(const node of record.addedNodes)decorate(node);
 });
 decorate(root);observer.observe(root,{childList:true,subtree:true,characterData:true});
 return ()=>observer.disconnect();
}
