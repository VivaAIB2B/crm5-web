import {useMemo,useState,useEffect} from 'react'
import {ResponsiveContainer,BarChart,Bar,LineChart,Line,PieChart,Pie,Cell,AreaChart,Area,ScatterChart,Scatter,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts'
import {chartData,inferColumns,proposeType,defaultPreference} from './chartModel'
import type {ChartPreference,ChartType,ResultColumn} from './chartModel'
import './charts.css'
type Props={data:Record<string,unknown>[];columns?:ResultColumn[];defaultType?:ChartType;preference?:ChartPreference|null;horizontalCategories?:boolean;onChange?:(type:ChartType,preference:ChartPreference)=>void}
const names:Record<ChartType,string>={auto:'Automatico',bar:'Barre',line:'Linee',pie:'Torta',area:'Area',scatter:'Scatter'}
const colors=['#34778c','#50a88c','#dfaa55','#8c75b8','#c46f79','#72a6bd']
export default function ResultChart({data,columns,defaultType='auto',preference,horizontalCategories=false,onChange}:Props){
 const cols=useMemo(()=>columns??inferColumns(data),[columns,data]);const automatic=proposeType(data,cols)
 const initial=()=>preference??defaultPreference(cols,defaultType)
 const [choice,setChoice]=useState<ChartPreference>(initial)
 useEffect(()=>setChoice(initial()),[preference,data,columns])
 const actual=choice.type==='auto'?automatic:choice.type
 const evaluated=chartData(data,cols,{...choice,type:actual})
 function change(next:ChartPreference){setChoice(next);onChange?.(next.type,next)}
 const horizontal=horizontalCategories&&actual==='bar'
 function categoryLabel(value:unknown){const label=String(value),id=label.match(/ · ID (.+)$/)?.[1];if(label.length<=26||!id)return label;const name=label.split(' · ')[0];return (name.length>17?name.slice(0,16)+'…':name)+' · #'+id}
 // Direct children also work with React 19 when Recharts' react-is cannot identify fragments.
 const common=[<CartesianGrid key="grid" strokeDasharray="3 3"/>,
  <XAxis key="x" type={horizontal?'number':'category'} dataKey={horizontal?undefined:choice.x_axis}/>,
  <YAxis key="y" type={horizontal?'category':'number'} dataKey={horizontal?choice.x_axis:undefined} width={horizontal?150:60}
   interval={horizontal?0:undefined} tickFormatter={horizontal?categoryLabel:undefined}/>,<Tooltip key="tooltip"/>]
 const title=cols.find(c=>c.name===choice.y_axis)?.label??choice.y_axis
 return <section className="result-chart" aria-label="Grafico risultati"><div className="chart-toolbar"><h3>{title} · {names[actual]}</h3><label>Tipo grafico<select aria-label="Tipo grafico" value={choice.type} onChange={e=>{const type=e.target.value as ChartType;const x=type==='scatter'?(cols.find(c=>c.name!==choice.y_axis&&['Integer','Decimal','FloatingPoint'].includes(c.typeFamily))?.name??choice.x_axis):type==='line'||type==='area'?(cols.find(c=>c.kind==='date')?.name??choice.x_axis):choice.x_axis;change({...choice,type,x_axis:x})}}>{Object.entries(names).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Asse X<select aria-label="Asse X" value={choice.x_axis} onChange={e=>change({...choice,x_axis:e.target.value})}>{cols.map(c=><option key={c.name} value={c.name}>{c.label}</option>)}</select></label><label>Asse Y<select aria-label="Asse Y" value={choice.y_axis} onChange={e=>change({...choice,y_axis:e.target.value})}>{cols.filter(c=>c.kind==='numeric').map(c=><option key={c.name} value={c.name}>{c.label}</option>)}</select></label><label>Ordine grafico<select aria-label="Ordine grafico" value={choice.sort} onChange={e=>change({...choice,sort:e.target.value as ChartPreference['sort']})}><option value="source">Della query</option><option value="desc">Misura decrescente</option><option value="asc">Misura crescente</option></select></label></div>
 {evaluated.error?<p role="status">{evaluated.error}</p>:!evaluated.data.length?<p>Nessun dato rappresentabile.</p>:<div className={'chart-surface'+(horizontal?' named-chart':'')} data-chart-type={actual}><div className={horizontal?'named-chart-canvas':undefined}><ResponsiveContainer width="100%" height={horizontal?Math.max(330,evaluated.data.length*26+40):330}>
 {actual==='bar'?<BarChart data={evaluated.data} layout={horizontal?'vertical':'horizontal'} margin={{top:10,right:20,left:10,bottom:25}}>{common}<Bar dataKey={choice.y_axis} name={title} fill={colors[0]} isAnimationActive={false}/></BarChart>:actual==='line'?<LineChart data={evaluated.data}>{common}<Line type="linear" dataKey={choice.y_axis} name={title} stroke={colors[0]} strokeWidth={2} isAnimationActive={false}/></LineChart>:actual==='area'?<AreaChart data={evaluated.data}>{common}<Area type="linear" dataKey={choice.y_axis} name={title} stroke={colors[0]} fill="#dceff1" isAnimationActive={false}/></AreaChart>:actual==='pie'?<PieChart><Pie data={evaluated.data} dataKey={choice.y_axis} nameKey={choice.x_axis} outerRadius={120} isAnimationActive={false} label>{evaluated.data.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Tooltip/></PieChart>:<ScatterChart><CartesianGrid/><XAxis type="number" dataKey={choice.x_axis} name={choice.x_axis}/><YAxis type="number" dataKey={choice.y_axis} name={title}/><Tooltip cursor={{strokeDasharray:'3 3'}}/><Scatter data={evaluated.data} fill={colors[0]} isAnimationActive={false}/></ScatterChart>}
 </ResponsiveContainer></div></div>}
 {horizontal&&<small>Nome completo e codice sono nella tabella e nel dettaglio delle barre. Su schermi stretti puoi scorrere il grafico in orizzontale.</small>}
 <small>Grafico delle righe restituite. I valori e la tabella restano quelli della query; Area non crea un cumulativo.</small></section>
}

