"""Add the unrendered engineering stages and stair alternatives to the editable Blender scene."""
from pathlib import Path
import os,json,bpy
root=Path(__file__).resolve().parent.parent
tmp=Path(os.environ['TEMP'])/'nastr-bim-review'
scene=bpy.context.scene
with (tmp/'model-info.json').open(encoding='utf8') as f: info=json.load(f)
rows={}
with (tmp/'ifc-elements.ndjson').open(encoding='utf8') as f:
 for line in f:
  row=json.loads(line);rows[row['id']]=row
def transfer(rootob,collection):
 for o in [rootob]+list(rootob.children_recursive):
  for old in list(o.users_collection):old.objects.unlink(o)
  collection.objects.link(o)
def folder(name,hidden=False):
 coll=bpy.data.collections.get(name)
 if coll:return coll
 coll=bpy.data.collections.new(name);scene.collection.children.link(coll);coll.hide_viewport=hidden;coll.hide_render=hidden;return coll
explicit=folder('Лестница · по альбому')
for o in list(bpy.data.objects):
 bid=o.get('bim_id')
 if bid in rows:
  r=rows[bid]
  for k in ['system','variant','status','note']:o[k]=r[k]
  if bid=='ST-album':transfer(o,explicit)
bpy.ops.import_scene.gltf(filepath=str(tmp/'overlay.glb'),import_pack_images=True)
for o in list(bpy.data.objects):
 bid=o.get('bim_id')
 if not bid:continue
 v=o.get('variant','');level=o.get('level',0)+1;sys=o.get('system')
 if v and v!='album':
  title='Лестница · '+('открытая' if v=='open13' else 'удлинённая · эскиз')
 elif sys in ['water','drain','climate','waterproof','electrical']:
  title=f'{level} этаж · '+info['systems'][sys][0]
 else:continue
 transfer(o,folder(title,True));o.name=bid+' · '+o.get('element_name','')
# Save a separate current-state view layer. Finishes and the proposed stair are hidden.
current=scene.view_layers.get('Квартира сейчас') or scene.view_layers.new('Квартира сейчас')
for layer in current.layer_collection.children:
 keep='Существующее состояние' in layer.name or layer.name in ['Свет для визуализации','Камеры интерьера']
 # The GLB importer may preserve an empty scene collection. Only named BIM collections matter.
 if not keep:layer.exclude=True
current.use=False
scene.view_layers[0].name='Проектный интерьер'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all()
path=root/'Передача'/'Интерьер и камеры.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
ids={o['bim_id'] for o in bpy.data.objects if 'bim_id' in o}
print('Saved model with',len(ids),'registered roots',len(bpy.data.collections),'collections',len(bpy.data.cameras),'cameras')
