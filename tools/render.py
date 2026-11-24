"""Blender background script. Rebuild the photographs from the viewer's GLB export."""
import bpy, json, math, os, sys
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
root=Path(__file__).resolve().parent.parent
tmp=Path(os.environ['TEMP'])/'nastr-bim-review'
draft='--draft' in args
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(tmp/'model.glb'),import_pack_images=True)
with (tmp/'model-info.json').open(encoding='utf8') as fp: info=json.load(fp)
unit=4.36/334
def location(x,z,h):return Vector(((x-450)*unit,-(z-550)*unit,h))
def collection(name):
 c=bpy.data.collections.new(name);s.collection.children.link(c);return c
lights=collection('Свет для визуализации')
cameras=collection('Камеры интерьера')
groups={}
for obj in list(bpy.data.objects):
 key=obj.get('bim_id')
 if not key:continue
 lvl=int(obj.get('level',0))+1
 stage=obj.get('phase','interior')
 title=f'{lvl} этаж · '+info['stages'].get(stage,stage)
 if title not in groups:groups[title]=collection(title)
 target=groups[title]
 for child in [obj]+list(obj.children_recursive):
  for old in list(child.users_collection):old.objects.unlink(child)
  target.objects.link(child)
 obj.name=key+' · '+str(obj.get('element_name',''))
s.render.engine='CYCLES'
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences
 prefs.compute_device_type='CUDA';prefs.get_devices()
 devs=[d for d in prefs.devices if d.type=='CUDA']
 for d in prefs.devices:d.use=d.type=='CUDA'
 s.cycles.device='GPU' if devs else 'CPU'
 print('Cycles renderer',s.cycles.device,[d.name for d in devs],flush=True)
except Exception as e:
 print(str(e),flush=True);s.cycles.device='CPU'
s.cycles.use_auto_tile=True;s.cycles.tile_size=256
s.cycles.samples=12 if draft else 38
if '--cpu' in args:s.cycles.device='CPU'
s.cycles.use_denoising=True
s.cycles.adaptive_threshold=.10 if draft else .045
s.cycles.max_bounces=8;s.cycles.diffuse_bounces=4;s.cycles.glossy_bounces=4;s.cycles.transparent_max_bounces=10
s.cycles.sample_clamp_indirect=5
s.render.resolution_x=840 if draft else 1440;s.render.resolution_y=520 if draft else 900
s.render.resolution_percentage=100
s.render.image_settings.file_format='JPEG';s.render.image_settings.quality=93
s.view_settings.view_transform='AgX'
s.view_settings.look='AgX - Medium High Contrast'
s.view_settings.exposure=-.37
world=bpy.data.worlds.new('Рассеянное дневное освещение');s.world=world;world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.69,.79,.92,1)
world.node_tree.nodes.get('Background').inputs[1].default_value=.63
def area(name,origin,target,power,width,depth,color):
 data=bpy.data.lights.new(name,'AREA');data.shape='RECTANGLE';data.energy=power;data.size=width;data.size_y=depth;data.color=color
 light=bpy.data.objects.new(name,data);lights.objects.link(light);light.location=location(*origin)
 direction=location(*target)-light.location;light.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
warm=(1,.834,.67);day=(.85,.92,1);neutral=(1,.925,.83)
# Window fill follows actual glazed sections; luminaire fill represents an interior
# lighting scenario. Powers are renderer parameters, not an electrical specification.
for floor,base in [(1,0),(2,2.88)]:
 for name,x,z,tx,tz,w,h,power in [('Гостиная',396,221,585,255,2.0,2.15,175),('Лоджия',277,392,370,478,1.20,2.1,125),('Столовая',225,452,306,575,1.0,1.85,105),('Среднее остекление',395,469,588,458,1.66,2.1,135)]:
  area(f'{name}, дневной · {floor}',(x,z,base+1.62),(tx,tz,base+1.15),power,w,h,day)
area('Кухня · направленный дневной',(333,663,2.52),(277,908,.83),118,1.45,1.18,day)
area('Кухня · трек у пеналов',(434,920,2.60),(360,965,.9),48,1.25,.22,warm)
area('Кухня · остров',(229,856,2.65),(296,818,.82),54,.87,.20,neutral)
area('Кухня · линия шкафов',(308,963,1.51),(300,968,.85),14,2.30,.07,warm)
area('Кухня · отражённый свет',(390,628,2.5),(306,804,1.16),45,1.8,1.38,neutral)
area('Гостиная · диван',(573,336,2.55),(468,315,.84),72,1.5,.42,neutral)
area('Гостиная · торец',(550,157,2.50),(505,133,1.06),36,1.22,.23,warm)
area('Столовая · подвес',(280,567,2.20),(279,560,.60),46,.85,.42,warm)
area('Прихожая · мягкий свет',(681,675,2.52),(740,720,1.03),40,.85,.55,warm)
area('Лестница · верхний свет',(682,481,5.42),(704,510,2.0),105,1.03,1.60,neutral)
area('Холл · верхний этаж',(455,510,5.46),(575,441,3.83),90,1.9,1.4,day)
area('Спальня · отражённый дневной',(402,661,5.24),(215,721,3.82),138,1.7,1.6,day)
area('Спальня · изголовье',(238,757,5.41),(167,725,3.81),51,1.53,.26,warm)
area('Спальня · мягкий боковой',(419,830,5.40),(263,721,3.53),55,1.2,.55,neutral)
area('Детская · трек',(535,248,5.38),(535,158,3.59),55,1.16,.4,warm)
area('Ванная · зеркало',(696,778,5.38),(722,681,3.75),64,.8,.55,neutral)
all_cameras={}
for p in info['photos']:
 floor=info['rooms'][p['room']][1];base=floor*2.88;name=p['name'];data=bpy.data.cameras.new(name);data.lens=p.get('lens',21.5);data.sensor_width=36
 cam=bpy.data.objects.new(name,data);cameras.objects.link(cam);cam.location=location(*p['from'],base+p['eye'])
 look=location(*p['to'],base+p['eye']);delta=look-cam.location;delta.z=math.tan(p.get('pitch',-.042))*delta.length
 cam.rotation_euler=delta.to_track_quat('-Z','Y').to_euler();data.clip_start=.035;all_cameras[p['id']]=cam
s.camera=all_cameras['kitchen']
for a in bpy.context.screen.areas:
 if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.context.preferences.filepaths.save_version=0
if not draft:
 s.render.filepath='//';bpy.ops.file.pack_all()
 bpy.ops.wm.save_as_mainfile(filepath=str(root/'Передача'/'Интерьер и камеры.blend'),compress=True)
out=tmp if draft else root/'assets'/'renders'
for key,cam in all_cameras.items():
 s.camera=cam;s.render.filepath=str(out/(('draft-' if draft else '')+key+'.jpg'));print('Rendering',key,flush=True)
 bpy.ops.render.render(write_still=True)

if not draft:
    s.render.resolution_x=3072
    s.render.resolution_y=1536
    s.cycles.samples=28
    s.cycles.adaptive_threshold=.065
    for key,cam in all_cameras.items():
        s.camera=cam
        level_rotation=cam.rotation_euler.copy()
        # A level optical axis keeps the horizon level for the interactive viewer.
        forward=cam.rotation_euler.to_quaternion()@Vector((0,0,-1))
        forward.z=0;cam.rotation_euler=forward.to_track_quat('-Z','Y').to_euler()
        cam.data.type='PANO';cam.data.panorama_type='EQUIRECTANGULAR'
        s.render.filepath=str(out/(key+'-360.jpg'))
        print('Panorama',key,flush=True)
        bpy.ops.render.render(write_still=True)
        cam.data.type='PERSP';cam.rotation_euler=level_rotation

