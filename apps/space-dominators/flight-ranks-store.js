import { firebaseConfig } from '../../js/core/firebase-config.js';

const collections = {solo:'spaceFlightSolo', team:'spaceFlightTeam'};
const personalId = name => 'pilot_' + encodeURIComponent(name);
const valueOf = ({integerValue, stringValue}) => integerValue === undefined ? stringValue : Number(integerValue);
const unpack = doc => Object.fromEntries(Object.entries(doc.fields).map(([key,value]) => [key,valueOf(value)]));
const fields = record => Object.fromEntries(Object.entries(record).map(([key,value]) =>
  [key, typeof value === 'number' ? {integerValue:String(value)} : {stringValue:value}]));
const pathUrl = path => path.split('/').map(encodeURIComponent).join('/');

export function flightStore({projectId=firebaseConfig.projectId, apiKey=firebaseConfig.apiKey, origin='https://firestore.googleapis.com'}={}) {
  const root = 'projects/' + projectId + '/databases/(default)/documents';
  async function request(path, body) {
    const response = await fetch(origin+'/v1/'+root+path+'?key='+encodeURIComponent(apiKey), {
      method:body ? 'POST' : 'GET', cache:'no-store', signal:AbortSignal.timeout(12000),
      ...(body ? {headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {})
    });
    if (!response.ok) {
      const error = new Error('Flight standings: HTTP ' + response.status);
      error.status=response.status;
      throw error;
    }
    return response.json();
  }
  async function document(path) {
    try { return await request('/'+pathUrl(path)); }
    catch (error) { if (error.status===404) return null; throw error; }
  }
  async function save(run) {
    const path=collections[run.mode]+'/'+personalId(run.pilot);
    const event=path+'/missions/'+run.id;
    for(let attempt=0; attempt<4; attempt++) {
      const [record, receipt]=await Promise.all([document(path),document(event)]);
      if(receipt) return;
      const writes=[{update:{name:root+'/'+event, fields:fields(run)}, currentDocument:{exists:false}}];
      const previous=record && unpack(record);
      if(!previous || run.score>previous.score || (run.score===previous.score && run.kills>previous.kills)) {
        writes.push({update:{name:root+'/'+path,fields:fields(run)},
          currentDocument:record ? {updateTime:record.updateTime} : {exists:false}});
      }
      try { await request(':commit',{writes}); return; }
      catch(error) {
        if(![400,409,412].includes(error.status) || attempt===3) throw error;
      }
    }
  }
  async function board(mode,pilot) {
    const collectionId=collections[mode], from=[{collectionId}];
    const [docs,personal]=await Promise.all([
      request(':runQuery',{structuredQuery:{from,orderBy:[{field:{fieldPath:'score'},direction:'DESCENDING'}],limit:6}}),
      pilot ? document(collectionId+'/'+personalId(pilot)) : null
    ]);
    const rows=docs.filter(d=>d.document).map(d=>unpack(d.document));
    let previous;
    rows.forEach((row,i)=>{row.rank=previous?.score===row.score ? previous.rank : i+1;previous=row;});
    if(personal && !rows.some(row=>row.pilot===pilot)) {
      const own=unpack(personal);
      const query={from,where:{fieldFilter:{field:{fieldPath:'score'},op:'GREATER_THAN',value:{integerValue:String(own.score)}}}};
      const count=await request(':runAggregationQuery',{structuredAggregationQuery:{structuredQuery:query,aggregations:[{alias:'ahead',count:{}}]}});
      own.rank=1+Number(count[0].result.aggregateFields.ahead.integerValue);
      return [...rows.slice(0,5),own];
    }
    return rows;
  }
  return {save,board};
}
