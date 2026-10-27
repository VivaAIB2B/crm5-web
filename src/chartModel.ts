export type ChartType='auto'|'bar'|'line'|'pie'|'area'|'scatter'
export type ResultColumn={name:string;label:string;kind:'categorical'|'numeric'|'date';typeFamily:string}
export type ChartPreference={type:ChartType;x_axis:string;y_axis:string;sort:'source'|'asc'|'desc'}
export function defaultPreference(columns:ResultColumn[],type:ChartType='auto'):ChartPreference{
 const x=columns.find(c=>c.kind==='date'||c.kind==='categorical')??columns[0]
 const y=columns.find(c=>c.kind==='numeric'&&c.name!==x?.name)
 return {type,x_axis:x?.name??'',y_axis:y?.name??'',sort:'source'}
}
export function inferColumns(rows:Record<string,unknown>[]):ResultColumn[]{
 return Object.keys(rows[0]??{}).map(name=>{const values=rows.map(r=>r[name]).filter(v=>v!=null);const date=values.length>0&&values.every(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(T|$)/.test(v)&&Number.isFinite(Date.parse(v)));const numeric=values.length>0&&values.every(v=>typeof v==='number'&&Number.isFinite(v));const id=/id$|^customer$/i.test(name);return {name,label:name,kind:date?'date':numeric&&!id?'numeric':'categorical',typeFamily:numeric?'FloatingPoint':date?'DateTime':'Text'}})
}
export function proposeType(rows:Record<string,unknown>[],columns:ResultColumn[]):Exclude<ChartType,'auto'>{
 const measure=columns.find(c=>c.kind==='numeric'),date=columns.find(c=>c.kind==='date'),category=columns.find(c=>c.kind==='categorical');
 if(date&&measure)return 'line'
 if(category&&measure){const values=rows.map(r=>r[measure.name]).filter(v=>v!=null);if(rows.length>0&&rows.length<=6&&values.length===rows.length&&values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)&&values.reduce<number>((s,v)=>s+Number(v),0)>0)return 'pie';return 'bar'}
 if(columns.filter(c=>c.kind==='numeric').length>=2)return 'scatter'
 return 'bar'
}
export function chartData(rows:Record<string,unknown>[],columns:ResultColumn[],preference:ChartPreference):{data:Record<string,unknown>[];error?:string}{
 const x=columns.find(c=>c.name===preference.x_axis),y=columns.find(c=>c.name===preference.y_axis);
 if(!x||!y||x.name===y.name||y.kind!=='numeric')return {data:[],error:'Seleziona due assi distinti e una misura numerica.'}
 if(['line','area'].includes(preference.type)&&x.kind!=='date')return {data:[],error:'Per un trend occorre una colonna data.'}
 const data:Record<string,unknown>[]=[]
 for(const row of rows){
  const value=row[y.name],key=row[x.name]
  if(value==null||key==null)continue
  if(typeof value!=='number'||!Number.isFinite(value)||(y.typeFamily==='Integer'&&!Number.isSafeInteger(value)))return {data:[],error:'Valori non rappresentabili con precisione nel grafico. Usa la tabella.'}
  if(preference.type==='pie'&&value<0)return {data:[],error:'La torta richiede misure non negative.'}
  if(preference.type==='scatter'&&(typeof key!=='number'||!Number.isFinite(key)||(x.typeFamily==='Integer'&&!Number.isSafeInteger(key))))return {data:[],error:'Lo scatter richiede due colonne numeriche rappresentabili.'}
  if(['line','area'].includes(preference.type)&&(typeof key!=='string'||!Number.isFinite(Date.parse(key))))return {data:[],error:'Data non valida per il grafico.'}
  data.push({...row,[x.name]:preference.type==='scatter'?key:String(key)})
 }
 if(preference.sort!=='source')data.sort((a,b)=>(Number(a[y.name])-Number(b[y.name]))*(preference.sort==='desc'?-1:1))
 if(preference.type==='pie'&&data.reduce((s,r)=>s+Number(r[y.name]),0)<=0)return {data:[],error:'La torta richiede un totale positivo.'}
 return {data}
}

