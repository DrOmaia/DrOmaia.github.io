/* ISP — all uploaded data is processed locally in the browser. */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const MAX_CAPACITY = 27;
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday'];

const demo = {
  courses: [
    {code:'IS201',title:'Introduction to Information Systems',campus:'Male',base_demand:43,level:'Year 2',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'Yes'},
    {code:'IS201',title:'Introduction to Information Systems',campus:'Female',base_demand:38,level:'Year 2',meeting_pattern:'Mon/Wed',needs_lab:'No',required:'Yes'},
    {code:'IS205',title:'Business Process Management',campus:'Male',base_demand:31,level:'Year 2',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'Yes'},
    {code:'IS231',title:'Systems Analysis and Design',campus:'Male',base_demand:47,level:'Year 2',meeting_pattern:'Mon/Wed',needs_lab:'No',required:'Yes'},
    {code:'IS241',title:'Database Management and Applications',campus:'Male',base_demand:35,level:'Year 2',meeting_pattern:'Sun/Tue',needs_lab:'Yes',required:'Yes'},
    {code:'IS311',title:'Web Development',campus:'Male',base_demand:28,level:'Year 3',meeting_pattern:'Mon/Wed',needs_lab:'Yes',required:'Yes'},
    {code:'IS321',title:'Enterprise Architecture',campus:'Male',base_demand:24,level:'Year 3',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'Yes'},
    {code:'IS361',title:'Project Management',campus:'Male',base_demand:36,level:'Year 3',meeting_pattern:'Mon/Wed',needs_lab:'No',required:'Yes'},
    {code:'IS371',title:'Quantitative Analysis',campus:'Male',base_demand:33,level:'Year 3',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'Yes'},
    {code:'IS450',title:'Digital Transformation Fundamentals',campus:'Male',base_demand:18,level:'DX Track',meeting_pattern:'Mon/Wed',needs_lab:'No',required:'No'},
    {code:'IS499',title:'Senior Project',campus:'Male',base_demand:19,level:'Year 4',meeting_pattern:'Thursday',needs_lab:'No',required:'Yes'},
    {code:'CS330',title:'Introduction to Operating Systems',campus:'Male',base_demand:0,level:'External',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'No',external:'Yes',fixed_slot:'ST-0900'}
  ],
  faculty: [
    {instructor:'Dr. Faculty A',campus:'Male',qualified_courses:'IS201, IS205, IS361',preferred_slots:'ST-0900,MW-1000',unavailable_slots:'ST-1300',max_sections:8},
    {instructor:'Dr. Faculty B',campus:'Male',qualified_courses:'IS231, IS321, IS499',preferred_slots:'MW-0900,TH-1000',unavailable_slots:'ST-0800',max_sections:8},
    {instructor:'Dr. Faculty C',campus:'Male',qualified_courses:'IS241, IS311',preferred_slots:'ST-1000,MW-1100',unavailable_slots:'MW-0800',max_sections:8},
    {instructor:'Dr. Faculty D',campus:'Male',qualified_courses:'IS371, IS450',preferred_slots:'ST-1100,MW-1300',unavailable_slots:'MW-0900',max_sections:8},
    {instructor:'Dr. Faculty E',campus:'Female',qualified_courses:'IS201, IS205, IS231',preferred_slots:'MW-0900,MW-1000',unavailable_slots:'ST-0800',max_sections:8}
  ],
  students: [
    {student_id:'S001',campus:'Male',planned_courses:'IS201,IS205',current_prerequisites:'',repeat_courses:'',preferred_slots:'ST-0900,MW-1000',avoid_slots:'ST-0800'},
    {student_id:'S002',campus:'Male',planned_courses:'IS231,IS241,CS330',current_prerequisites:'IS201',repeat_courses:'IS231',preferred_slots:'MW-0900,ST-1000',avoid_slots:'MW-1300'},
    {student_id:'S003',campus:'Male',planned_courses:'IS311,IS361,IS371',current_prerequisites:'IS241',repeat_courses:'',preferred_slots:'ST-1000,MW-1000',avoid_slots:'ST-1400'},
    {student_id:'S004',campus:'Male',planned_courses:'IS321,IS361,IS371',current_prerequisites:'',repeat_courses:'',preferred_slots:'ST-1100,MW-0900',avoid_slots:'MW-1400'},
    {student_id:'S005',campus:'Male',planned_courses:'IS450,IS499',current_prerequisites:'IS371',repeat_courses:'',preferred_slots:'MW-1100,TH-1000',avoid_slots:'ST-0800'},
    {student_id:'S006',campus:'Female',planned_courses:'IS201,IS205,IS231',current_prerequisites:'',repeat_courses:'IS201',preferred_slots:'MW-0900,MW-1000',avoid_slots:'MW-1400'}
  ],
  slots: [
    {slot_id:'ST-0800',days:'Sunday/Tuesday',start:'08:00',end:'09:15',campus:'Male',room:'2-A01',room_type:'Classroom',room_capacity:30},
    {slot_id:'ST-0900',days:'Sunday/Tuesday',start:'09:30',end:'10:45',campus:'Male',room:'2-A02',room_type:'Classroom',room_capacity:30},
    {slot_id:'ST-1000',days:'Sunday/Tuesday',start:'11:00',end:'12:15',campus:'Male',room:'Lab 1',room_type:'Lab',room_capacity:27},
    {slot_id:'ST-1100',days:'Sunday/Tuesday',start:'11:00',end:'12:15',campus:'Male',room:'2-A03',room_type:'Classroom',room_capacity:30},
    {slot_id:'ST-1300',days:'Sunday/Tuesday',start:'13:00',end:'14:15',campus:'Male',room:'Lab 2',room_type:'Lab',room_capacity:27},
    {slot_id:'ST-1400',days:'Sunday/Tuesday',start:'14:30',end:'15:45',campus:'Male',room:'2-A04',room_type:'Classroom',room_capacity:30},
    {slot_id:'MW-0800',days:'Monday/Wednesday',start:'08:00',end:'09:15',campus:'Male',room:'2-A01',room_type:'Classroom',room_capacity:30},
    {slot_id:'MW-0900',days:'Monday/Wednesday',start:'09:30',end:'10:45',campus:'Male',room:'2-A02',room_type:'Classroom',room_capacity:30},
    {slot_id:'MW-1000',days:'Monday/Wednesday',start:'11:00',end:'12:15',campus:'Male',room:'2-A03',room_type:'Classroom',room_capacity:30},
    {slot_id:'MW-1100',days:'Monday/Wednesday',start:'11:00',end:'12:15',campus:'Male',room:'Lab 1',room_type:'Lab',room_capacity:27},
    {slot_id:'MW-1300',days:'Monday/Wednesday',start:'13:00',end:'14:15',campus:'Male',room:'Lab 2',room_type:'Lab',room_capacity:27},
    {slot_id:'TH-1000',days:'Thursday',start:'10:00',end:'12:30',campus:'Male',room:'2-A05',room_type:'Classroom',room_capacity:30},
    {slot_id:'F-MW-0900',days:'Monday/Wednesday',start:'09:30',end:'10:45',campus:'Female',room:'W-301',room_type:'Classroom',room_capacity:30},
    {slot_id:'F-MW-1000',days:'Monday/Wednesday',start:'11:00',end:'12:15',campus:'Female',room:'W-302',room_type:'Classroom',room_capacity:30},
    {slot_id:'F-ST-1100',days:'Sunday/Tuesday',start:'11:00',end:'12:15',campus:'Female',room:'W-Lab1',room_type:'Lab',room_capacity:27}
  ]
};
demo.slots.push(...demo.slots.filter(s=>s.campus==='Male').map((s,i)=>({...s,room:/lab/i.test(s.room_type)?`Lab ${i+5}`:`2-B${String(i+1).padStart(2,'0')}`})));

let state = {
  version:1, step:1, term:'', defaultCapacity:20, adjustment:15,
  inputs:{courses:[],faculty:[],students:[],slots:[]}, filenames:{}, capacities:{}, included:{}, approved:false,
  options:[], selectedOption:0, savedAt:null
};
let modalMode='save', pendingProjectBytes=null;

function normKey(k){return String(k||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function normalizeRows(rows){return rows.filter(r=>Object.values(r).some(v=>v!==''&&v!=null)).map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[normKey(k),v])))}
function list(v){return String(v||'').split(/[,;|]/).map(x=>x.trim()).filter(Boolean)}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function courseKey(c){return `${String(c.code).trim()}|${c.campus||'Male'}`}
function isYes(v){return /^(yes|true|1|y)$/i.test(String(v||''))}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function autosave(){try{localStorage.setItem('isp_autosave',JSON.stringify({...state,savedAt:new Date().toISOString()}))}catch(e){}}

function validate(kind,rows){
  const required={courses:['code','title','campus'],faculty:['instructor','campus','qualified_courses'],students:['campus','planned_courses'],slots:['slot_id','days','start','end','campus','room']}[kind];
  if(!rows.length)return 'The file has no data rows.';
  const keys=new Set(Object.keys(rows[0])); const missing=required.filter(k=>!keys.has(k));
  return missing.length?`Missing columns: ${missing.join(', ')}`:'';
}
async function readWorkbook(file,kind){
  if(!window.XLSX)throw new Error('The Excel reader is still loading. Please try again.');
  const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:'array'});const preferred={courses:'Courses',faculty:'Faculty',students:'Students',slots:'TimeSlots'}[kind];const ws=wb.Sheets[preferred]||wb.Sheets[wb.SheetNames[0]];
  const rows=normalizeRows(XLSX.utils.sheet_to_json(ws,{defval:''}));const error=validate(kind,rows);if(error)throw new Error(error);return rows;
}

function getCollected(c){
  return state.inputs.students.filter(s=>String(s.campus||'').toLowerCase()===String(c.campus||'').toLowerCase() && [...list(s.planned_courses),...list(s.repeat_courses)].map(x=>x.toUpperCase()).includes(String(c.code).toUpperCase())).length;
}
function project(c){const collected=getCollected(c);const base=Math.max(num(c.base_demand),collected);return Math.ceil(base*(1+state.adjustment/100))}
function capacity(c){return Math.max(10,Math.min(MAX_CAPACITY,num(state.capacities[courseKey(c)],state.defaultCapacity)))}
function sectionPlan(c){
  const demand=project(c),cap=capacity(c);let count=Math.max(1,Math.ceil(demand/cap));
  let distribution=Array.from({length:count},(_,i)=>Math.floor(demand/count)+(i<demand%count?1:0));
  return {demand,cap,count,distribution,low:distribution.some(x=>x<10)};
}
function recommendedAdjustment(){
  const students=state.inputs.students.length,totalBase=state.inputs.courses.filter(c=>!isYes(c.external)).reduce((s,c)=>s+num(c.base_demand),0);
  if(!students||!totalBase)return 20;const coverage=Math.min(1,students/Math.max(1,totalBase/4));
  return coverage<.45?20:coverage<.7?15:10;
}

function updateTop(){const term=state.term||$('#termInput').value.trim();$$('.term-inline').forEach(x=>x.textContent=term||'—');$('#termLabel').textContent=term?`Term ${term}`:'Not set'}
function showStep(n){state.step=n;$$('.view').forEach(v=>v.classList.toggle('active',Number(v.dataset.view)===n));$$('.step').forEach(b=>b.classList.toggle('active',Number(b.dataset.step)===n));updateTop();window.scrollTo({top:0,behavior:'smooth'});autosave();if(n===2)renderDemand();if(n===3)renderOffering();if(n===4)renderSchedules();if(n===5)renderExport()}
function updateInputs(){
  const ready=Object.keys(state.inputs).filter(k=>state.inputs[k].length).length;$('#inputStatus').textContent=`${ready} of 4 inputs ready`;
  $$('.upload').forEach(el=>{const k=el.dataset.kind;el.classList.toggle('ready',!!state.inputs[k].length);if(state.filenames[k])el.querySelector('em').textContent=state.filenames[k]});
  const ok=ready===4 && ($('#termInput').value.trim()||state.term);$('#toDemandBtn').disabled=!ok;
  const c=$('#dataCheck');if(ok){c.className='callout success';c.innerHTML=`<span>✓</span><div><strong>All inputs passed the initial check</strong><p>${state.inputs.courses.length} course rows, ${state.inputs.faculty.length} faculty rows, ${state.inputs.students.length} student responses, and ${state.inputs.slots.length} official room slots are ready.</p></div>`}
}

function renderMetrics(target,items){$(target).innerHTML=items.map(x=>`<div class="metric"><span>${esc(x.label)}</span><strong>${esc(x.value)}</strong><small>${esc(x.note||'')}</small></div>`).join('')}
function renderDemand(){
  const courses=state.inputs.courses.filter(c=>!isYes(c.external));const projected=courses.reduce((s,c)=>s+project(c),0);const sections=courses.reduce((s,c)=>s+sectionPlan(c).count,0);const lows=courses.filter(c=>sectionPlan(c).low).length;
  renderMetrics('#demandMetrics',[{label:'Student responses',value:state.inputs.students.length,note:'Processed locally'},{label:'Projected demand',value:projected,note:`Includes +${state.adjustment}%`},{label:'Proposed sections',value:sections,note:'Default capacity applied'},{label:'Chair alerts',value:lows,note:'Below 10 in a section'}]);
  $('#adjustment').value=state.adjustment;$('#adjustmentValue').textContent=`+${state.adjustment}%`;const rec=recommendedAdjustment();$('#recommendationText').innerHTML=`<strong>Projection recommendation: +${rec}%.</strong> Based on response coverage and the available base-demand figures. Review this planning assumption before approving the offering.`;
  $('#demandBody').innerHTML=courses.map(c=>{const p=sectionPlan(c),status=p.low?'<span class="pill warn">Chair review</span>':'<span class="pill good">Within range</span>';return `<tr><td><strong>${esc(c.code)}</strong><br><small>${esc(c.title)}</small></td><td>${esc(c.campus)}</td><td>${getCollected(c)}</td><td>${num(c.base_demand)}</td><td><strong>${p.demand}</strong></td><td><input class="cap-input" data-cap="${esc(courseKey(c))}" type="number" min="10" max="27" value="${p.cap}" aria-label="Capacity for ${esc(c.code)}"></td><td>${p.count}<br><small>${p.distribution.join(' / ')}</small></td><td>${status}</td></tr>`}).join('');
}
function renderOffering(){
  const courses=state.inputs.courses.filter(c=>!isYes(c.external));$('#offeringBody').innerHTML=courses.map(c=>{const k=courseKey(c),p=sectionPlan(c);if(state.included[k]===undefined)state.included[k]=true;return `<tr><td><input class="check offer-check" data-course="${esc(k)}" type="checkbox" ${state.included[k]?'checked':''}></td><td><strong>${esc(c.code)}</strong><br><small>${esc(c.title)}</small></td><td>${esc(c.campus)}</td><td>${p.demand}</td><td>${p.count}</td><td>${p.distribution.join(' / ')} <small>(max ${p.cap})</small></td><td>${p.low?'<span class="pill warn">Below minimum</span>':isYes(c.required)?'<span class="pill good">Required</span>':'<span class="pill">Elective</span>'}</td></tr>`}).join('');
  $('#approvalState').textContent=state.approved?'Offering approved':'Awaiting Chair approval';$('#approvalState').classList.toggle('approved',state.approved);$('#approveBtn').textContent=state.approved?'Unlock offering':'Approve course offering';$('#generateBtn').disabled=!state.approved;updateTop();
}

function buildConflictWeights(){const map={};state.inputs.students.forEach(s=>{const cs=list(s.planned_courses).map(x=>x.toUpperCase());for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){const k=[cs[i],cs[j]].sort().join('|');map[k]=(map[k]||0)+1}});return map}
function slotPreferenceScore(slot,course,mode){
  let score=0;const studentRows=state.inputs.students.filter(s=>String(s.campus).toLowerCase()===String(course.campus).toLowerCase()&&list(s.planned_courses).map(x=>x.toUpperCase()).includes(String(course.code).toUpperCase()));
  studentRows.forEach(s=>{if(list(s.preferred_slots).includes(slot.slot_id))score+=mode==='student'?6:3;if(list(s.avoid_slots).includes(slot.slot_id))score-=8;const planned=list(s.planned_courses).map(x=>x.toUpperCase());const blocked=state.inputs.courses.filter(x=>isYes(x.external)&&planned.includes(String(x.code).toUpperCase())).map(x=>x.fixed_slot).filter(Boolean);if(blocked.includes(slot.slot_id))score-=mode==='student'?15:9});return score;
}
function generateOne(mode,index){
  const weights=buildConflictWeights(),occupiedRoom=new Set(),occupiedFaculty=new Set(),courseSlots={},sections=[],issues=[];
  const included=state.inputs.courses.filter(c=>!isYes(c.external)&&state.included[courseKey(c)]!==false).sort((a,b)=>mode==='student'?project(b)-project(a):String(a.code).localeCompare(String(b.code)));
  const facultyLoads={};
  included.forEach(c=>{
    const p=sectionPlan(c);
    p.distribution.forEach((expected,i)=>{
      const qualified=state.inputs.faculty.filter(f=>String(f.campus).toLowerCase()===String(c.campus).toLowerCase()&&list(f.qualified_courses).map(x=>x.toUpperCase()).includes(String(c.code).toUpperCase())&&(facultyLoads[f.instructor]||0)<num(f.max_sections,99));
      let candidates=[];
      qualified.forEach(f=>state.inputs.slots.filter(s=>{const tk=`${s.days}|${s.start}|${s.end}`;return String(s.campus).toLowerCase()===String(c.campus).toLowerCase()&&(!isYes(c.needs_lab)||/lab/i.test(s.room_type||''))&&num(s.room_capacity,99)>=Math.min(expected,p.cap)&&!occupiedRoom.has(`${tk}|${s.room}`)&&!occupiedFaculty.has(`${tk}|${f.instructor}`)&&!list(f.unavailable_slots).includes(s.slot_id)}).forEach(s=>{
        let sc=slotPreferenceScore(s,c,mode);if(list(f.preferred_slots).includes(s.slot_id))sc+=mode==='faculty'?8:4;sc-=num(facultyLoads[f.instructor]);
        const tk=`${s.days}|${s.start}|${s.end}`;const assigned=Object.entries(courseSlots);assigned.forEach(([other,slots])=>{if(slots.includes(tk)){const w=weights[[String(c.code).toUpperCase(),other].sort().join('|')]||0;sc-=w*(mode==='student'?9:5)}});sc+=((index+String(c.code).charCodeAt(0)+i)%5)/10;candidates.push({f,s,sc})
      }));
      candidates.sort((a,b)=>b.sc-a.sc);const pick=candidates[0];
      if(pick){const tk=`${pick.s.days}|${pick.s.start}|${pick.s.end}`;occupiedRoom.add(`${tk}|${pick.s.room}`);occupiedFaculty.add(`${tk}|${pick.f.instructor}`);facultyLoads[pick.f.instructor]=(facultyLoads[pick.f.instructor]||0)+1;(courseSlots[String(c.code).toUpperCase()] ||= []).push(tk);sections.push({code:c.code,title:c.title,campus:c.campus,section:i+1,expected,capacity:p.cap,slot_id:pick.s.slot_id,time_key:tk,days:pick.s.days,start:pick.s.start,end:pick.s.end,instructor:pick.f.instructor,room:pick.s.room,status:expected<10?'Chair review':'Scheduled'})}
      else{sections.push({code:c.code,title:c.title,campus:c.campus,section:i+1,expected,capacity:p.cap,slot_id:'',days:'TBA',start:'',end:'',instructor:'TBA',room:'TBA',status:'Manual scheduling'});issues.push(`${c.code} Section ${i+1} needs manual scheduling.`)}
      if(expected<10)issues.push(`${c.code} Section ${i+1} has ${expected} expected students; Chair decision required.`)
    })
  });
  let studentConflicts=0;state.inputs.students.forEach(st=>{const wanted=list(st.planned_courses).map(x=>x.toUpperCase());const chosen=sections.filter(x=>wanted.includes(String(x.code).toUpperCase()));for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++)if(chosen[i].time_key&&chosen[i].time_key===chosen[j].time_key)studentConflicts++;const externalSlots=state.inputs.courses.filter(x=>isYes(x.external)&&wanted.includes(String(x.code).toUpperCase())).map(x=>x.fixed_slot).filter(Boolean);chosen.forEach(x=>{if(externalSlots.includes(x.slot_id))studentConflicts++})});
  const facultyMatches=sections.filter(x=>{const f=state.inputs.faculty.find(f=>f.instructor===x.instructor);return f&&list(f.preferred_slots).includes(x.slot_id)}).length;const pref=Math.round(100*facultyMatches/Math.max(1,sections.filter(x=>x.slot_id).length));
  return {mode,name:mode==='student'?'Student priority':mode==='faculty'?'Faculty priority':'Balanced',description:mode==='student'?'Minimizes likely student course clashes.':mode==='faculty'?'Gives stronger weight to faculty time preferences.':'Balances student conflicts, faculty preferences, and resource use.',sections,issues,studentConflicts,facultyPreference:pref,manual:sections.filter(x=>!x.slot_id).length,score:Math.max(0,100-studentConflicts*7-sections.filter(x=>!x.slot_id).length*10-Math.max(0,70-pref)/4)}
}
function buildOptions(){state.options=[generateOne('student',0),generateOne('balanced',1),generateOne('faculty',2)];state.selectedOption=0;autosave()}
function renderSchedules(){if(!state.options.length)buildOptions();const o=state.options[state.selectedOption];$('#optionTabs').innerHTML=state.options.map((x,i)=>`<button class="option-tab ${i===state.selectedOption?'active':''}" data-option="${i}"><strong>${esc(x.name)}</strong><small>Score ${Math.round(x.score)} · ${x.manual} manual</small></button>`).join('');$('#optionTitle').textContent=o.name;$('#optionDesc').textContent=o.description;renderMetrics('#scheduleMetrics',[{label:'Option score',value:Math.round(o.score),note:'Decision-support rating'},{label:'Student conflicts',value:o.studentConflicts,note:'Likely overlaps'},{label:'Faculty preference',value:`${o.facultyPreference}%`,note:'Preferred slots met'},{label:'Manual scheduling',value:o.manual,note:'Unresolved sections'}]);renderCalendar(o);renderSections(o);$('#issueList').innerHTML=(o.issues.length?o.issues.map(x=>`<div class="issue"><strong>Review required</strong><small>${esc(x)}</small></div>`):'<div class="issue good"><strong>No capacity alerts</strong><small>All proposed sections meet the minimum enrollment threshold.</small></div>')}
function renderCalendar(o){
  const campus=$('#campusFilter').value;const sections=o.sections.filter(x=>campus==='all'||x.campus===campus);const times=[...new Set(state.inputs.slots.map(s=>s.start).filter(Boolean))].sort();let html='<div class="calendar-grid"><div class="cal-head">Time</div>'+DAYS.map(d=>`<div class="cal-head">${d.slice(0,3)}</div>`).join('');times.forEach(t=>{html+=`<div class="cal-time">${t}</div>`;DAYS.forEach(d=>{const hits=sections.filter(x=>x.start===t&&String(x.days).includes(d));html+=`<div class="cal-cell">${hits.map(x=>`<div class="class-card ${String(x.campus).toLowerCase()}"><strong>${esc(x.code)} · S${x.section}</strong>${esc(x.instructor)}<br>${esc(x.room)}</div>`).join('')}</div>`})});html+='</div>';$('#calendar').innerHTML=html;
}
function renderSections(o){$('#sectionBody').innerHTML=o.sections.map(x=>`<tr><td><strong>${esc(x.code)}</strong></td><td>${x.section}</td><td>${esc(x.campus)}</td><td>${x.expected} / ${x.capacity}</td><td>${esc(x.days)}<br><small>${esc(x.start)}${x.end?'–'+esc(x.end):''}</small></td><td>${esc(x.instructor)}</td><td>${esc(x.room)}</td><td><span class="pill ${x.status==='Scheduled'?'good':x.status==='Chair review'?'warn':'bad'}">${esc(x.status)}</span></td></tr>`).join('')}
function renderExport(){const o=state.options[state.selectedOption]||{sections:[],manual:0,studentConflicts:0};$('#exportSummary').innerHTML=[['Term',state.term],['Courses',new Set(o.sections.map(x=>x.code)).size],['Sections',o.sections.length],['Alerts',o.issues?.length||0]].map(x=>`<div class="summary-item"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}

function workbookFromState(){
  const o=state.options[state.selectedOption];const wb=XLSX.utils.book_new();
  const requests=o.sections.map(x=>({'Course Code':x.code,'Course Title':x.title,'Campus':x.campus,'Section':x.section,'Expected Students':x.expected,'Requested Capacity':x.capacity,'Days':x.days,'Start':x.start,'End':x.end,'Suggested Instructor':x.instructor,'Room':x.room,'Status':x.status}));
  const faculty={};o.sections.forEach(x=>{if(x.instructor==='TBA')return;(faculty[x.instructor] ||= []).push(x)});
  const facRows=Object.entries(faculty).map(([name,ss])=>({'Instructor':name,'Courses':[...new Set(ss.map(x=>x.code))].join(', '),'Total Sections':ss.length,'Scheduled Times':ss.map(x=>`${x.days} ${x.start}`).join('; ')}));
  const issues=(o.issues||[]).map((x,i)=>({'#':i+1,'Issue':x,'Owner':'Chair review','Status':'Open'}));
  const summary=[{'Metric':'Term','Value':state.term},{'Metric':'Selected option','Value':o.name},{'Metric':'Courses','Value':new Set(o.sections.map(x=>x.code)).size},{'Metric':'Sections','Value':o.sections.length},{'Metric':'Response gap adjustment','Value':`${state.adjustment}%`},{'Metric':'Default capacity','Value':state.defaultCapacity},{'Metric':'Maximum capacity','Value':MAX_CAPACITY},{'Metric':'Likely student conflicts','Value':o.studentConflicts},{'Metric':'Manual scheduling','Value':o.manual}];
  [['Section Requests',requests],['Faculty Schedule',facRows],['Conflict Report',issues.length?issues:[{'Issue':'No open alerts','Status':'Clear'}]],['Summary',summary]].forEach(([n,r])=>{const ws=XLSX.utils.json_to_sheet(r);XLSX.utils.book_append_sheet(wb,ws,n)});return wb;
}

function templateWorkbook(){const wb=XLSX.utils.book_new();const sheets={Courses:[{code:'IS231',title:'Systems Analysis and Design',campus:'Male',base_demand:40,level:'Year 2',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'Yes',external:'No',fixed_slot:''},{code:'CS330',title:'Introduction to Operating Systems',campus:'Male',base_demand:0,level:'External',meeting_pattern:'Sun/Tue',needs_lab:'No',required:'No',external:'Yes',fixed_slot:'ST-0900'}],Faculty:[{instructor:'Dr. Name',campus:'Male',qualified_courses:'IS231, IS361',preferred_slots:'ST-0900, MW-1000',unavailable_slots:'ST-1300',max_sections:3}],Students:[{student_id:'Optional ID',campus:'Male',planned_courses:'IS231, IS241',current_prerequisites:'IS201',repeat_courses:'',preferred_slots:'ST-0900, MW-1000',avoid_slots:'ST-0800'}],TimeSlots:[{slot_id:'ST-0900',days:'Sunday/Tuesday',start:'09:30',end:'10:45',campus:'Male',room:'2-A01',room_type:'Classroom',room_capacity:30}]};Object.entries(sheets).forEach(([n,r])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(r),n));return wb}

async function deriveKey(password,salt){const enc=new TextEncoder();const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encryptProject(password){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await deriveKey(password,salt),plain=new TextEncoder().encode(JSON.stringify({...state,savedAt:new Date().toISOString()})),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));return new Blob([JSON.stringify({format:'ISP1',salt:Array.from(salt),iv:Array.from(iv),data:Array.from(cipher)})],{type:'application/json'})}
async function decryptProject(bytes,password){const obj=JSON.parse(new TextDecoder().decode(bytes));if(obj.format!=='ISP1')throw new Error('Unsupported project file.');const key=await deriveKey(password,new Uint8Array(obj.salt));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(obj.iv)},key,new Uint8Array(obj.data));return JSON.parse(new TextDecoder().decode(plain))}
function openModal(mode){modalMode=mode;$('#passwordModal').hidden=false;$('#projectPassword').value='';$('#modalError').textContent='';$('#modalTitle').textContent=mode==='save'?'Protect your project':'Unlock your project';$('#modalText').textContent=mode==='save'?'Enter a password. You will need it to resume this project.':'Enter the password used when this project was saved.';$('#projectPassword').focus()}
function closeModal(){$('#passwordModal').hidden=true;pendingProjectBytes=null}

$$('.upload input').forEach(inp=>inp.addEventListener('change',async e=>{const wrap=e.target.closest('.upload'),kind=wrap.dataset.kind,file=e.target.files[0];if(!file)return;try{state.inputs[kind]=await readWorkbook(file,kind);state.filenames[kind]=file.name;state.approved=false;state.options=[];updateInputs();autosave();toast(`${kind[0].toUpperCase()+kind.slice(1)} loaded successfully`)}catch(err){toast(err.message);e.target.value=''}}));
$('#termInput').addEventListener('input',e=>{state.term=e.target.value.trim();updateTop();updateInputs();autosave()});
$('#defaultCapacity').addEventListener('change',e=>{state.defaultCapacity=Math.max(10,Math.min(MAX_CAPACITY,num(e.target.value,20)));e.target.value=state.defaultCapacity;state.approved=false;state.options=[];autosave()});
$('#demoBtn').addEventListener('click',()=>{state.inputs=structuredClone(demo);state.filenames={courses:'Demo Courses.xlsx',faculty:'Demo Faculty.xlsx',students:'Demo Students.xlsx',slots:'Demo Time Slots.xlsx'};state.term=$('#termInput').value.trim()||'Demo';$('#termInput').value=state.term;state.included={};state.capacities={};state.approved=false;state.options=[];updateInputs();updateTop();autosave();toast('Demo workspace loaded')});
$('#templateBtn').addEventListener('click',()=>{if(!window.XLSX)return toast('Excel tools are still loading');XLSX.writeFile(templateWorkbook(),'ISP_Input_Templates.xlsx')});
$('#toDemandBtn').addEventListener('click',()=>{state.term=$('#termInput').value.trim();showStep(2)});
$('#adjustment').addEventListener('input',e=>{state.adjustment=num(e.target.value);state.approved=false;state.options=[];renderDemand();autosave()});
$('#aiRecommendBtn').addEventListener('click',()=>{state.adjustment=recommendedAdjustment();state.approved=false;state.options=[];renderDemand();toast(`Recommended adjustment applied: +${state.adjustment}%`)});
$('#demandBody').addEventListener('change',e=>{if(!e.target.matches('[data-cap]'))return;const v=Math.max(10,Math.min(MAX_CAPACITY,num(e.target.value,state.defaultCapacity)));state.capacities[e.target.dataset.cap]=v;e.target.value=v;state.approved=false;state.options=[];renderDemand();autosave()});
$('#offeringBody').addEventListener('change',e=>{if(e.target.matches('.offer-check')){state.included[e.target.dataset.course]=e.target.checked;state.approved=false;renderOffering();autosave()}});
$('#selectAllBtn').addEventListener('click',()=>{state.inputs.courses.filter(c=>!isYes(c.external)).forEach(c=>state.included[courseKey(c)]=true);state.approved=false;renderOffering();autosave()});
$('#approveBtn').addEventListener('click',()=>{state.approved=!state.approved;state.options=[];renderOffering();toast(state.approved?'Course offering approved':'Course offering unlocked')});
$('#generateBtn').addEventListener('click',()=>{buildOptions();showStep(4);toast('Three schedule options generated')});
$('#rebuildBtn').addEventListener('click',()=>{buildOptions();renderSchedules();toast('Schedule options rebuilt')});
$('#optionTabs').addEventListener('click',e=>{const b=e.target.closest('[data-option]');if(b){state.selectedOption=num(b.dataset.option);renderSchedules();autosave()}});
$('#campusFilter').addEventListener('change',()=>renderCalendar(state.options[state.selectedOption]));
$('#exportExcelBtn').addEventListener('click',()=>{if(!window.XLSX)return toast('Excel tools are still loading');XLSX.writeFile(workbookFromState(),`ISP_Term_${state.term||'Plan'}_Registration.xlsx`);toast('Registration workbook exported')});
$('#saveBtn').addEventListener('click',()=>openModal('save'));$('#saveProjectBtn').addEventListener('click',()=>openModal('save'));
$('#resumeBtn').addEventListener('click',()=>$('#projectFile').click());
$('#projectFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;pendingProjectBytes=new Uint8Array(await f.arrayBuffer());openModal('load');e.target.value=''});
$('#modalConfirm').addEventListener('click',async()=>{const pw=$('#projectPassword').value;if(pw.length<6){$('#modalError').textContent='Use at least 6 characters.';return}try{if(modalMode==='save'){const blob=await encryptProject(pw);download(blob,`ISP_Term_${state.term||'Project'}.isp`);closeModal();toast('Encrypted project saved')}else{state=await decryptProject(pendingProjectBytes,pw);closeModal();hydrate();showStep(state.step||1);toast('Project resumed successfully')}}catch(e){$('#modalError').textContent='The password is incorrect or the file is invalid.'}});
$$('.modal-close,.modal-cancel').forEach(b=>b.addEventListener('click',closeModal));
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>showStep(num(b.dataset.back))));$$('[data-next]').forEach(b=>b.addEventListener('click',()=>showStep(num(b.dataset.next))));
$$('.step').forEach(b=>b.addEventListener('click',()=>{const n=num(b.dataset.step);if(n===1||(n<=3&&state.inputs.courses.length)||(n===4&&state.approved)||(n===5&&state.options.length))showStep(n);else toast(n>=4?'Approve the offering and build schedule options first.':'Load the planning inputs first.')}));
$('#newProjectBtn').addEventListener('click',()=>{if(confirm('Start a new project? Download your current project first if you need it.')){localStorage.removeItem('isp_autosave');location.reload()}});
function hydrate(){$('#termInput').value=state.term||'';$('#defaultCapacity').value=state.defaultCapacity||20;updateInputs();updateTop()}
(function init(){try{const saved=JSON.parse(localStorage.getItem('isp_autosave'));if(saved&&saved.inputs?.courses?.length){state=saved;hydrate();toast('A local draft is available. Use Resume project for an encrypted backup.')}else hydrate()}catch(e){hydrate()}})();
