/** Будущий серверный AI-комментарий дополняет разбор, но не меняет данные, расчёты и баллы. */
export type FeedbackRequest={caseId:string;score:number;criteria:{name:string;points:number;max:number;explanation:string}[]};
export interface FeedbackProvider{explain(request:FeedbackRequest):Promise<string>;}
export const deterministicFeedback:FeedbackProvider={async explain(request){const missed=request.criteria.filter(c=>c.points<c.max);return missed.length?missed.map(c=>`${c.name}: ${c.explanation}`).join('\n'):'Все критерии выполнены. Попробуйте следующий кейс и объясните решение своими словами.';}};
/** Совместимый серверный адаптер подключается вместо deterministicFeedback. Ключи остаются на сервере. */
export async function safeFeedback(request:FeedbackRequest,provider:FeedbackProvider=deterministicFeedback){try{return await provider.explain(request);}catch{return deterministicFeedback.explain(request);}}
