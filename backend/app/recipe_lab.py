"""Private Recipe Lab read-only dashboard mounted under /recipes/.
Never serves raw source PDFs or local JSON publicly.
Requires RECIPE_LAB_USER, RECIPE_LAB_PASSWORD and RECIPE_LAB_GITHUB_TOKEN.
"""
from __future__ import annotations

import hmac
import os
import secrets
from html import escape

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials

router = APIRouter(prefix="/recipes", tags=["private-recipe-lab"])
security = HTTPBasic(auto_error=False)
REPO = "nimania/recipe-lab"
BASE = f"https://api.github.com/repos/{REPO}/contents/"


def auth(credentials: HTTPBasicCredentials | None = Depends(security)) -> None:
    user = os.getenv("RECIPE_LAB_USER", "")
    password = os.getenv("RECIPE_LAB_PASSWORD", "")
    token = os.getenv("RECIPE_LAB_GITHUB_TOKEN", "")
    if not user or not password or not token:
        raise HTTPException(503, "Recipe Lab is not configured")
    if (credentials is None
            or not hmac.compare_digest(credentials.username.encode(), user.encode())
            or not hmac.compare_digest(credentials.password.encode(), password.encode())):
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": 'Basic realm="Recipe Lab"'})


PAGE = """<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>آزمایشگاه رسپی داینر | پندار</title><style>
*{box-sizing:border-box}body{font:15px/1.9 Tahoma,Arial,sans-serif;margin:0;background:#f8f7f3;color:#25211e}
header{background:#24201d;color:white;padding:24px max(18px,calc((100vw - 1050px)/2))}h1{margin:0;font-size:25px}
main{max-width:1050px;margin:25px auto;padding:0 18px}.summary{color:#665e56;margin-bottom:15px}
input{width:100%;padding:12px 14px;border:1px solid #d8d2ca;border-radius:9px;font:inherit;margin-bottom:15px}
.layout{display:grid;grid-template-columns:290px 1fr;gap:16px}.list,.detail{background:white;border:1px solid #e7e1d8;border-radius:11px;overflow:hidden}
.list button{width:100%;text-align:right;background:white;border:0;border-bottom:1px solid #ede7dd;cursor:pointer;padding:14px;font:inherit}
.list button.active{background:#faf0e5}.list small{display:block;color:#777}.detail{padding:24px;min-height:360px}
h2{margin:0}h3{margin:15px 0 5px}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #eee;padding:8px}
.warn{color:#874b28;background:#faf0e5;padding:10px;border-radius:8px}.secondary{color:#777}
@media(max-width:730px){.layout{grid-template-columns:1fr}.detail{padding:16px}}
@media print{header,input,.list,.summary{display:none}.layout{display:block}.detail{border:0}}
</style></head><body><header><h1>آزمایشگاه رسپی داینر</h1><div>پندار · داشبورد خصوصی</div></header>
<main><div id="summary" class="summary">در حال دریافت اطلاعات…</div><input id="search" placeholder="نام غذا یا مواد اولیه را جست‌وجو کن">
<div class="layout"><nav id="list" class="list"></nav><article id="detail" class="detail">یک رسپی انتخاب کن.</article></div></main>
<script>
let recipes=[],sources=[];const $=x=>document.getElementById(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const units={kg:'کیلوگرم',g:'گرم',L:'لیتر',count:'عدد',cup:'پیمانه',tsp:'قاشق چای‌خوری',tbsp:'قاشق غذاخوری',bunch:'دسته',cloves:'حبه',slices:'ورقه',to_taste:'',walnut_sized_piece:'قطعه به‌اندازه گردو'};
const title=id=>sources.find(x=>x.id===id)?.title||id;
function show(i){const r=recipes[i];if(!r)return;let rows=r.ingredients.map(x=>'<tr><td>'+esc(x.name_fa)+'</td><td>'+esc(x.amount??(x.amount_min!=null?x.amount_min+' تا '+x.amount_max:'به میزان لازم'))+'</td><td>'+esc(units[x.unit]||x.unit)+'</td></tr>').join('');
$('detail').innerHTML='<div class="warn">پیش‌نویس پژوهشی · آزمون عملی نشده</div><h2>'+esc(r.name_fa)+'</h2><p class="secondary">'+esc(title(r.source_refs[0]?.source_id))+' · صفحه PDF '+esc(r.source_refs[0]?.pdf_page)+'</p><h3>مواد اولیه</h3><table>'+rows+'</table><h3>خلاصه روش تهیه</h3><p>'+esc(r.method_summary||'هنوز ثبت نشده')+'</p><button onclick="window.print()">چاپ کارت</button>';document.querySelectorAll('.list button').forEach(b=>b.classList.toggle('active',b.dataset.id===r.id))}
function render(){const q=$('search').value.trim();$('list').textContent='';recipes.forEach((r,i)=>{if(q&&!([r.name_fa,r.method_summary,...r.ingredients.map(x=>x.name_fa)].join(' ').includes(q)))return;const b=document.createElement('button');b.dataset.id=r.id;const strong=document.createElement('strong');strong.textContent=r.name_fa;const small=document.createElement('small');small.textContent=title(r.source_refs[0]?.source_id);b.append(strong,small);b.onclick=()=>show(i);$('list').append(b)})}
$('search').oninput=render;
fetch('/recipes/api/data',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{recipes=data.recipes;sources=data.sources;$('summary').textContent=sources.length+' منبع · '+recipes.length+' رکورد رسپی · ۰ مورد آزمون‌شده';render();show(0)}).catch(e=>{$('summary').textContent='داده بارگذاری نشد: '+e.message});
</script></body></html>"""


@router.get("/", dependencies=[Depends(auth)], response_class=HTMLResponse)
async def dashboard():
    return HTMLResponse(PAGE, headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"})


async def private_json(client: httpx.AsyncClient, path: str):
    response = await client.get(BASE + path, headers={
        "Authorization": f"Bearer {os.environ['RECIPE_LAB_GITHUB_TOKEN']}",
        "Accept": "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    if response.status_code != 200:
        raise HTTPException(502, "Private recipe source unavailable")
    return response.json()


@router.get("/api/data", dependencies=[Depends(auth)])
async def data():
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            catalog = await private_json(client, "data/sources/catalog.json")
            index = await private_json(client, "data/recipes/index.json")
            entries = index.get("recipes", [])
            if not isinstance(entries, list) or len(entries) > 500:
                raise HTTPException(502, "Invalid recipe index")
            recipes = []
            for item in entries:
                name = item.get("file", "")
                if not name.startswith("SRC-") or not name.endswith(".json") or "/" in name or ".." in name:
                    raise HTTPException(502, "Invalid recipe identifier")
                recipes.append(await private_json(client, "data/recipes/" + name))
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            raise HTTPException(502, "Recipe source unavailable") from exc
    return JSONResponse({"sources": catalog["sources"], "recipes": recipes},
        headers={"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow"})
