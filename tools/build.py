"""Bundle the apartment viewer as a local file including drawings and textures."""
from pathlib import Path
import base64, json, mimetypes
directory=Path(__file__).resolve().parent.parent
assets={}
for sub in ['sheets','interior','references','renders','overlays','stairviews']:
    for p in sorted((directory/'assets'/sub).glob('*')):
        if p.suffix.lower() not in ('.jpg','.png','.webp'): continue
        assets[p.relative_to(directory).as_posix()]='data:'+{'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[p.suffix.lower()]+';base64,'+base64.b64encode(p.read_bytes()).decode()
album=next(directory.parent.glob('*.pdf')).name
manifest='window.ALBUM_FILE='+json.dumps(album,ensure_ascii=False)+';window.ASSETS='+json.dumps(assets)+';'
scripts=['assets/core/three.min.js','phases.js','architecture.js','stairs.js','services.js','interior.js','viewport.js','overlays.js','app.js']
chunks=[manifest]+[(directory/f).read_text('utf-8-sig') for f in scripts]
shell=(directory/'app.tpl').read_text('utf-8-sig').replace('/*STYLE*/',(directory/'interface.css').read_text('utf-8-sig'))
shell=shell.replace('<!--SCRIPTS-->',''.join('<script>'+x.replace('</script','<\\/script')+'</script>\n' for x in chunks))
out=directory/'Модель ремонта.html'
out.write_text(shell,'utf8')
print(out.name,round(out.stat().st_size/1024**2,1),'MB')

