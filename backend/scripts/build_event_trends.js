/* Build from the recent archive as well as the compact feed; same engine as UI. */
const fs=require('node:fs'),path=require('node:path');
const {build,stamp}=require('../../web-static/event-trends.js');
const site=process.argv[2];if(!site)throw Error('Usage: build_event_trends.js SITE');
const data=path.join(site,'data'),feed=JSON.parse(fs.readFileSync(path.join(data,'stories.json'),'utf8'));
const cards=new Map(feed.map(s=>[String(s.id),s]));
const now=Date.now(),archive=path.join(data,'story');
if(fs.existsSync(archive))for(const name of fs.readdirSync(archive)){
  if(!name.endsWith('.json'))continue;
  try{const s=JSON.parse(fs.readFileSync(path.join(archive,name),'utf8'));
    if(stamp(s.published_at)<now-72*3600000 || cards.has(String(s.id)))continue;
    s.source_names=s.source_names||(s.sources||[]).map(x=>x.source_name).filter(Boolean);
    // Dossiers need feed-sized summaries and identities, not full article bodies.
    const {id,headline_fa,summary_fa,published_at,source_count,source_names,importance_score,category,entities,topics,trend,image_url,credibility,iran_relevance}=s;
    cards.set(String(id),{id,headline_fa,summary_fa,published_at,source_count,source_names,importance_score,category,entities,topics,trend,image_url,credibility,iran_relevance});
  }catch(e){console.warn('Skipping event archive',name,e.message);}
}
const events=build([...cards.values()],now);
fs.writeFileSync(path.join(data,'event-trends.json'),JSON.stringify({built_at:new Date(now).toISOString(),events}));
console.log(`Event trends: ${events.length} dossiers from ${cards.size} recent/feed reports`);
