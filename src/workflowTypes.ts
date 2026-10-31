import type {Answer,RowRule} from './scopeTypes'
export type WorkflowMode='setup'|'test'|'technical'
export type WorkflowMessage={id:string;role:string;text:string;error?:string|null}
export type BusinessBrief={activities:string;information:string;meanings:string;visibility:string;exclusions:string;scenarios:{id:string;name:string;visibility:string;restricted:boolean}[];openPoints:{text:string;scenarios:string[]}[];technicalTasks:string[]}
export type Technical={columns:string[];excludedColumns:string[];rows:RowRule[];members:string[];testActor:string;coverageConfirmed:boolean;memberRows?:Record<string,RowRule[]>}
export type Scenario={id:string;name:string;version:string;status:string;technical?:Technical;candidate?:{version:string};tasks?:string[];turns?:{id:string;question:string;kind:string;answer?:Answer;error?:string}[];evidence?:unknown[]}
export type WorkflowView={revision:number;name:string;legacy:boolean;legacyPublished:boolean;workflow:{testMessages?:WorkflowMessage[];dialogue:{messages:WorkflowMessage[];summaryOffered:boolean;proposal?:BusinessBrief};versions:{number:number;id:string;brief:BusinessBrief}[];scenarios:Scenario[];published:{id:string;name:string}[];reopened:boolean}}
export const scenarioStates:Record<string,string>={awaiting_technical:'In attesa di operazioni tecniche',ready:'Pronto per il collaudo',testing:'Collaudo in corso',tested:'Collaudato'}
