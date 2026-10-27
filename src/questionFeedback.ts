import type { QuestionConversation } from './requirementsApi'
export type FeedbackMessage={role:'user'|'assistant';text:string}
export type FeedbackAmbiguity={question:string;status:'open'|'resolved';answer:string|null}
export type QuestionFeedback={schemaVersion:'1.0';id:string;origin:'client'|'setup';targetId:string;packageVersion:string;recordedAt:string;reviewStatus:'unreviewed';question:string;messages:FeedbackMessage[];requirements:{key:string;value:string}[];ambiguities:FeedbackAmbiguity[];outcome:{status:'clarification_required'|'executable'|'unsupported'|'rejected'|'requirements'|'prepared'|'result'|'failed';capabilityId:string|null;parameters:Record<string,string|number|boolean|null>}}
export function feedback(origin:QuestionFeedback['origin'],targetId:string,packageVersion:string,question:string,messages:FeedbackMessage[],ambiguities:FeedbackAmbiguity[],outcome:QuestionFeedback['outcome'],requirements:QuestionFeedback['requirements']=[]):QuestionFeedback{
 return {schemaVersion:'1.0',id:crypto.randomUUID(),origin,targetId,packageVersion,recordedAt:new Date().toISOString(),reviewStatus:'unreviewed',question,messages:messages.map(({role,text})=>({role,text})),requirements,ambiguities,outcome}
}
export function setupFeedback(c:QuestionConversation,targetId:string,packageVersion:string){
 const ambiguities:FeedbackAmbiguity[]=[]
 c.messages.forEach((m,i)=>{const data=(m as FeedbackMessage & {data?:{clarification?:{question?:string}|null}}).data;const question=data?.clarification?.question;if(typeof question==='string'&&!ambiguities.some(a=>a.question===question)){const answer=c.messages.slice(i+1).find(x=>x.role==='user')?.text??null;ambiguities.push({question,status:answer?'resolved':'open',answer})}})
 const current=c.response?.clarification?.question;if(current&&!ambiguities.some(a=>a.question===current))ambiguities.push({question:current,status:'open',answer:null})
 return feedback('setup',targetId,packageVersion,c.messages.find(m=>m.role==='user')?.text??c.title,c.messages,ambiguities,{status:c.preparation?'prepared':'requirements',capabilityId:c.sourceId??null,parameters:{}},c.response?.requirements.map(r=>({key:r.key,value:r.value}))??[])
}
export function downloadFeedback(value:QuestionFeedback){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='crm5-question-'+value.origin+'-'+value.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

