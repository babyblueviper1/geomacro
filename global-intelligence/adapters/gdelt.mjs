import {getJson,observation} from "./http.mjs";
export async function searchGdelt(countryIso2,{queryExtra=""}={}) {
  const countryFilter=String(countryIso2||"").trim().toUpperCase();
  const query=[countryFilter ? `country:${countryFilter}` : "",String(queryExtra||"").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  if(!query) throw new Error("GDELT query is required");
  const q=encodeURIComponent(query);
  const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&format=json&maxrecords=50&sort=HybridRel`;
  const data=await getJson(url);
  return (data.articles ?? []).map(a=>observation({
    sourceId:"gdelt_v2",category:"GEOPOLITICS",countryIso3:null,
    publishedAt:a.seendate ? a.seendate.replace(/^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2}).*$/,"$1-$2-$3T$4:$5:$6Z") : null,
    title:a.title,summary:a.title,url:a.url,confidence:0.35,raw:a
  }));
}
