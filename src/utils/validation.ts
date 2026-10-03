export function required(value:string){return value.trim().length>0}; export function maxWords(value:string,limit:number){return value.trim().split(/\s+/).filter(Boolean).length<=limit}
