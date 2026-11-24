"""Matched physical renders of the entrance to the stair and the upper landing."""
from pathlib import Path
import bpy, math, sys
from mathutils import Vector
root=Path(__file__).resolve().parent.parent;out=root/'assets'/'stairviews'
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.adaptive_threshold=.10;s.cycles.use_auto_tile=False
s.render.resolution_x=832;s.render.resolution_y=520;s.render.resolution_percentage=100;s.cycles.use_denoising=True
s.cycles.device='CPU'
if '--cpu' not in args:
 try:
  pref=bpy.context.preferences.addons['cycles'].preferences;pref.compute_device_type='OPTIX';pref.get_devices()
  for dev in pref.devices:dev.use=dev.type=='OPTIX'
  if any(dev.use for dev in pref.devices):s.cycles.device='GPU'
 except Exception:pass
from collections import OrderedDict
variants=OrderedDict([('none',None),('album','Лестница · по альбому'),('open13','Лестница · открытая'),('even15','Лестница · удлинённая · эскиз')])
u=4.36/334
def loc(x,z,h):return Vector(((x-450)*u,-(z-550)*u,h))
def aim(c,at,target):
 c.location=loc(*at);c.rotation_euler=(loc(*target)-c.location).to_track_quat('-Z','Y').to_euler()
cam=s.camera;cam.data.lens=18.6
allowed=[o for o in bpy.data.objects if 'bim_id' in o and o.get('phase')=='existing' and o.get('element_name')!='Оконный блок' and o.get('element_name')!='Входная дверь ПР-1']
concrete=bpy.data.materials.new('Условный необработанный бетон');concrete.use_nodes=True
nt=concrete.node_tree;pr=nt.nodes['Principled BSDF'];pr.inputs['Roughness'].default_value=.9
noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=34;noise.inputs['Detail'].default_value=3
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.19,.185,.16,1);ramp.color_ramp.elements[1].color=(.46,.44,.4,1)
nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],pr.inputs['Base Color'])
originals={}
for rootob in allowed:
 for o in rootob.children_recursive:
  if o.type=='MESH':originals[o]=[m for m in o.data.materials]
for variant,collname in variants.items():
 for coll in bpy.data.collections:
  if coll.name.startswith('Лестница ·'):coll.hide_render=(coll.name!=collname)
  if 'этаж · ' in coll.name and not coll.name.endswith('Существующее состояние'):
   if coll.name.split('этаж · ')[-1] in ['Мебель и оборудование','Чистовая отделка','Перегородки и проёмы','Проект лестницы']:
    coll.hide_render=variant=='none'
 for o,original in originals.items():
  for i,mat in enumerate(original):o.data.materials[i]=concrete if variant=='none' else mat
 for label,at,target in [('approach',(485,613,1.47),(717,515,1.39)),('landing',(583,420,4.40),(706,466,2.23))]:
  file=out/f'{variant}-{label}.jpg'
  if file.exists() and file.stat().st_size>10000:continue
  aim(cam,at,target);s.render.filepath=str(file);print('Stair view',variant,label,s.cycles.device,flush=True)
  bpy.ops.render.render(write_still=True)
