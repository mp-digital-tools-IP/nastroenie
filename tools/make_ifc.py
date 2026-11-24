"""Export the apartment scene to IFC4 and verify the written exchange file.

Input is the stable-ID scene extract from the app. Its vertices are already
metres in IFC world coordinates (Three X, -Three Z, Three Y). Do not rotate
them again. Run with an IFC-enabled Python or pass --ifc-libs. Input and
output paths are independent of the current working directory.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import uuid


ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path(tempfile.gettempdir()) / "nastr-bim-review"
LEVELS = (0.0, 2.88)
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "urn:nastroenie:apartment:repair-model")
CARD = "Nastroenie_ModelCard"
ROOM_AREA = "Nastroenie_RoomSchedule"
SERVICE_TYPES = {
    "water": "WATERSUPPLY",
    "drain": "WASTEWATER",
    "electrical": "ELECTRICAL",
    "climate": "HEATING",
}
AREA_SOURCE = "Монтажные планы 08–09, экспликация помещений, PDF, стр. 8–9."


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--elements", type=Path, default=SCRATCH / "ifc-elements.ndjson")
    parser.add_argument("--info", type=Path, default=SCRATCH / "model-info.json")
    parser.add_argument("--output", type=Path, default=ROOT / "Передача" / "Модель квартиры.ifc")
    parser.add_argument("--ifc-libs", type=Path, default=Path(tempfile.gettempdir()) / "nas-ifc-libs")
    return parser.parse_args()


def guid(key):
    return ifcopenshell.guid.compress(uuid.uuid5(NAMESPACE, key).hex)


def read_inputs(args):
    info = json.loads(args.info.read_text(encoding="utf-8-sig"))
    rows = []
    with args.elements.open(encoding="utf-8-sig") as stream:
        for line in stream:
            if not line.strip():
                continue
            r = json.loads(line)
            if r["system"] == "stair" and r.get("variant") != "album":
                continue
            vertices, triangles = r["verts"], r["faces"]
            if r["level"] not in (0, 1) or not vertices or not triangles:
                raise ValueError(f"Missing level or geometry in {r['id']}")
            if any(len(v) != 3 or not all(math.isfinite(n) for n in v) for v in vertices):
                raise ValueError(f"Invalid vertex in {r['id']}")
            if any(len(t) != 3 or len(set(t)) != 3 or min(t) < 0 or max(t) >= len(vertices) for t in triangles):
                raise ValueError(f"Invalid triangle in {r['id']}")
            rows.append(r)
    if not rows or len({r["id"] for r in rows}) != len(rows):
        raise ValueError("Missing or duplicate scene IDs")
    stairs = [r for r in rows if r["system"] == "stair"]
    if len(stairs) != 1 or stairs[0]["stage"] == "existing":
        raise ValueError("Expected the single unbuilt stair from the design album")
    rooms = info["rooms"]
    if len(rooms) != 14 or abs(sum(p[2] for p in rooms) - 124.9) > .001:
        raise ValueError("Room schedule differs from the 14-space/124.90 m² design album")
    return rows, info


def element_type(r):
    """Return a concrete IFC4 class and a type justified by the source card."""
    system, kind, key = r["system"], r["kind"], r["id"]
    if system == "water":
        return "IfcPipeFitting", "CONNECTOR"
    if system == "drain":
        return "IfcPipeSegment", "NOTDEFINED"
    if system == "climate":
        if kind == "Радиатор":
            return "IfcSpaceHeater", "RADIATOR"
        # An outlined area with no chosen heating product.
        return "IfcBuildingElementProxy", "USERDEFINED"
    if system == "electrical":
        if kind in {"Светильник", "Трек освещения"}:
            return "IfcLightFixture", "NOTDEFINED"
        if kind == "Электровывод":
            return "IfcCableFitting", "EXIT"
        modules = r["note"].split(". ")[0]
        families = [s for s in ("розетка", "порт интернета", "выключатель", "терморегулятор") if s in modules]
        if len(families) != 1:
            # A single frame containing several function types. Card retains
            # the module breakdown; IFC does not create additional outlets.
            return "IfcBuildingElementProxy", "USERDEFINED"
        return {
            "розетка": ("IfcOutlet", "POWEROUTLET"),
            "порт интернета": ("IfcOutlet", "DATAOUTLET"),
            "выключатель": ("IfcSwitchingDevice", "NOTDEFINED"),
            "терморегулятор": ("IfcUnitaryControlElement", "THERMOSTAT"),
        }[families[0]]
    cls = r["ifcClass"]
    if cls == "IfcWall":
        return cls, "PARTITIONING" if system == "partition" and "перегородка" in r["name"].lower() else "NOTDEFINED"
    if cls == "IfcSlab":
        return cls, "FLOOR" if kind == "slab" else "NOTDEFINED"
    if cls == "IfcCovering":
        if system == "waterproof":
            return cls, "MEMBRANE"
        if key.startswith("fit-floor-"):
            return cls, "FLOORING"
        if key.startswith("fit-ceiling-face-"):
            return cls, "CEILING"
        return cls, "CLADDING" if "облицовка" in r["name"].lower() else "NOTDEFINED"
    if cls == "IfcStair":
        return cls, "HALF_WINDING_STAIR"
    if cls == "IfcSanitaryTerminal":
        if "bathtub" in key:
            return cls, "BATH"
        if "-wc-" in key:
            return cls, "TOILETPAN"
        return cls, "WASHHANDBASIN" if "vanity" in key else "NOTDEFINED"
    if cls in {"IfcWindow", "IfcDoor", "IfcFurniture", "IfcLightFixture"}:
        return cls, "NOTDEFINED"
    return "IfcBuildingElementProxy", "USERDEFINED"


def bounds(vertices):
    axes = list(zip(*vertices))
    return tuple(min(a) for a in axes), tuple(max(a) for a in axes)


def spatial_room_key(level, name):
    aliases = {
        "Детская": "Детская спальня",
        "Гардеробная": "Гардеробная спальни" if level else "Гардеробная у входа",
    }
    return level, aliases.get(name, name)


class Exchange:
    def __init__(self, info):
        self.model = ifcopenshell.file(schema="IFC4")
        self.make = self.model.create_entity
        self.info = info
        self.units = {}
        self.styles = {}
        self.spaces = {}
        self.storey_members = defaultdict(list)
        self.room_references = defaultdict(list)
        self.service_members = defaultdict(list)
        self.stage_members = defaultdict(list)
        self.history = self.make_owner()
        self.context = self.make_context()
        self.project, self.building, self.storeys = self.make_structure()
        self.make_rooms()

    def rooted(self, cls, key, **values):
        return self.make(cls, GlobalId=guid(key), OwnerHistory=self.history, **values)

    def make_owner(self):
        developer = self.make("IfcOrganization", Name="OpenAI")
        application = self.make("IfcApplication", ApplicationDeveloper=developer,
            Version="1", ApplicationFullName="Codex • Экспорт модели ремонта", ApplicationIdentifier="Codex")
        owner = self.make("IfcOrganization", Name="Проект ремонта квартиры ЖК «Настроение»")
        user = self.make("IfcPersonAndOrganization",
            ThePerson=self.make("IfcPerson", Identification="Владелец модели"), TheOrganization=owner)
        return self.make("IfcOwnerHistory", OwningUser=user, OwningApplication=application,
            ChangeAction="NOCHANGE", CreationDate=int(datetime.now(timezone.utc).timestamp()))

    def axis(self, xyz=(0., 0., 0.)):
        point = self.make("IfcCartesianPoint", Coordinates=tuple(float(x) for x in xyz))
        return self.make("IfcAxis2Placement3D", Location=point)

    def place(self, parent=None, xyz=(0., 0., 0.)):
        return self.make("IfcLocalPlacement", PlacementRelTo=parent, RelativePlacement=self.axis(xyz))

    def make_context(self):
        context = self.make("IfcGeometricRepresentationContext", CoordinateSpaceDimension=3,
            ContextType="Model", Precision=1e-5, WorldCoordinateSystem=self.axis())
        self.body = self.make("IfcGeometricRepresentationSubContext", ContextIdentifier="Body",
            ContextType="Model", ParentContext=context, TargetView="MODEL_VIEW")
        return context

    def aggregate(self, parent, items, key):
        self.rooted("IfcRelAggregates", "aggregate:"+key, RelatingObject=parent, RelatedObjects=items)

    def make_structure(self):
        for kind, name in (("LENGTHUNIT","METRE"),("AREAUNIT","SQUARE_METRE"),
                           ("VOLUMEUNIT","CUBIC_METRE"),("PLANEANGLEUNIT","RADIAN")):
            self.units[kind] = self.make("IfcSIUnit", UnitType=kind, Name=name)
        project = self.rooted("IfcProject", "project", Name="ЖК «Настроение» • Модель ремонта",
            Description="Двухуровневая квартира. Координационная модель по дизайн-проекту и описанию владельца.",
            Phase="Планирование ремонта", RepresentationContexts=[self.context],
            UnitsInContext=self.make("IfcUnitAssignment", Units=list(self.units.values())))
        building = self.rooted("IfcBuilding", "building", Name="ЖК «Настроение» • квартира",
            Description="Модель охватывает квартиру; общий объём здания отсутствует.",
            ObjectPlacement=self.place(), CompositionType="ELEMENT")
        self.aggregate(project, [building], "project")
        storeys = []
        for level, z in enumerate(LEVELS):
            storeys.append(self.rooted("IfcBuildingStorey", f"storey:{level}", Name=f"Этаж {level+1}",
                ObjectPlacement=self.place(building.ObjectPlacement, (0,0,z)),
                CompositionType="ELEMENT", Elevation=z))
        self.aggregate(building, storeys, "building")
        self.properties(project, "project", "Nastroenie_Exchange", {
            "Исходная модель": ("IfcLabel", "Рабочая 3D-модель ремонта квартиры"),
            "Единицы сцены": ("IfcLabel", "Метры"),
            "Система координат": ("IfcText", "Локальная система квартиры, ось Z вверх. Геодезическая привязка отсутствует."),
            "Отметка верхнего пола": ("IfcLengthMeasure", LEVELS[1]),
            "Лестница": ("IfcText", "Экспортирован только проект из альбома. По описанию владельца лестница ещё не установлена."),
            "Геометрия помещений": ("IfcText", "Помещения созданы по экспликации. Границы и объёмы отдельно не моделировались."),
            "Назначение": ("IfcText", "Визуальная координация. Статус, привязки и применимость для работ указаны в карточках."),
        })
        return project, building, storeys

    def properties(self, obj, key, name, fields):
        props = []
        for label, (typ, value) in fields.items():
            if value is None:
                continue
            if typ in {"IfcLengthMeasure", "IfcAreaMeasure"}:
                value = float(value)
            props.append(self.make("IfcPropertySingleValue", Name=label,
                NominalValue=self.make(typ, value)))
        pset = self.rooted("IfcPropertySet", f"pset:{name}:{key}", Name=name, HasProperties=props)
        self.rooted("IfcRelDefinesByProperties", f"link:{name}:{key}",
            RelatedObjects=[obj], RelatingPropertyDefinition=pset)

    def make_rooms(self):
        room_levels = defaultdict(list)
        for i,(name,level,area,*_) in enumerate(self.info["rooms"]):
            key = f"space:{level}:{i+1}"
            room = self.rooted("IfcSpace", key, Name=name, LongName=name, CompositionType="ELEMENT",
                PredefinedType="NOTDEFINED", ObjectPlacement=self.place(self.storeys[level].ObjectPlacement),
                Description=f"Помещение № {i+1}. {AREA_SOURCE} Геометрия границ и объём не определены.")
            self.spaces[(level,name)] = room
            room_levels[level].append(room)
            qty = self.make("IfcQuantityArea", Name="Площадь по экспликации", AreaValue=float(area),
                Unit=self.units["AREAUNIT"], Description=AREA_SOURCE)
            qset = self.rooted("IfcElementQuantity", "qty:"+key, Name=ROOM_AREA,
                MethodOfMeasurement="Значение из экспликации дизайн-проекта", Quantities=[qty])
            self.rooted("IfcRelDefinesByProperties", "quantity-link:"+key, RelatedObjects=[room],
                RelatingPropertyDefinition=qset)
            self.properties(room, key, CARD, {
                "Номер помещения": ("IfcIdentifier", str(i+1)),
                "Источник": ("IfcText", AREA_SOURCE),
                "Геометрия": ("IfcText", "Только запись экспликации. Замкнутый объём помещения не задавался."),
            })
        for level, rooms in room_levels.items():
            self.aggregate(self.storeys[level], rooms, f"spaces:{level}")

    def style(self, system):
        if system not in self.styles:
            hex_color = self.info["systems"][system][1].lstrip("#")
            rgb = [int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
            color = self.make("IfcColourRgb", Red=rgb[0], Green=rgb[1], Blue=rgb[2])
            shading = self.make("IfcSurfaceStyleShading", SurfaceColour=color, Transparency=0.)
            self.styles[system] = self.make("IfcSurfaceStyle", Name=self.info["systems"][system][0],
                Side="BOTH", Styles=[shading])
        return self.styles[system]

    def element(self, r):
        key, level = r["id"], r["level"]
        vertices, triangles = r["verts"], r["faces"]
        lo, hi = bounds(vertices)
        origin = ((lo[0]+hi[0])*.5, (lo[1]+hi[1])*.5, lo[2])
        local_xyz = [(round(x-origin[0],7),round(y-origin[1],7),round(z-origin[2],7))
                     for x,y,z in vertices]
        coords = self.make("IfcCartesianPointList3D", CoordList=local_xyz)
        indices = [[a+1,b+1,c+1] for a,b,c in triangles]
        # A card may combine closed, open and disjoint meshes; don't infer
        # watertight solids from coincident vertex indices in the source.
        body = self.make("IfcTriangulatedFaceSet", Coordinates=coords, CoordIndex=indices)
        self.make("IfcStyledItem", Item=body, Styles=[self.style(r["system"])])
        rep = self.make("IfcShapeRepresentation", ContextOfItems=self.body,
            RepresentationIdentifier="Body", RepresentationType="Tessellation", Items=[body])
        cls, typ = element_type(r)
        element = self.rooted(cls, "element:"+key, Tag=key, Name=r["name"],
            Description=r["note"], ObjectType=r["kind"] or r["name"], PredefinedType=typ,
            ObjectPlacement=self.place(self.storeys[level].ObjectPlacement,
                (origin[0],origin[1],origin[2]-LEVELS[level])),
            Representation=self.make("IfcProductDefinitionShape", Representations=[rep]))
        self.storey_members[level].append(element)
        self.stage_members[r["stage"]].append(element)
        if r["system"] in SERVICE_TYPES:
            self.service_members[r["system"]].append(element)
        room_key = spatial_room_key(level,r["room"])
        if room_key in self.spaces:
            self.room_references[room_key].append(element)
        geom = "Габаритный параллелепипед визуального объекта" if r["proxy"] else "Триангуляция геометрии из 3D-сцены"
        self.properties(element, "element:"+key, CARD, {
            "ID в приложении": ("IfcIdentifier", key),
            "Раздел": ("IfcLabel", self.info["systems"][r["system"]][0]),
            "Этап ремонта": ("IfcLabel", self.info["stages"][r["stage"]]),
            "Статус источника": ("IfcLabel", r["status"]),
            "Вариант": ("IfcLabel", "По альбому; лестница ещё не установлена" if r["variant"]=="album" else "Основной"),
            "Источник": ("IfcText", r["source"]),
            "Страницы PDF": ("IfcLabel", ", ".join(str(n) for n in r["pages"])),
            "Помещение по карточке": ("IfcLabel", r["room"] or None),
            "Отметка центра от чистого пола": ("IfcLengthMeasure", r.get("mountHeight")),
            "Количество в карточке": ("IfcInteger", r.get("count")),
            "Площадь по карточке": ("IfcAreaMeasure", r.get("area")),
            "Примечание": ("IfcText", r["note"]),
            "Представление в IFC": ("IfcText", geom),
            "Габаритный прокси": ("IfcBoolean", bool(r["proxy"])),
        })

    def relations(self):
        for level, items in self.storey_members.items():
            self.rooted("IfcRelContainedInSpatialStructure", f"contain:{level}",
                RelatedElements=items, RelatingStructure=self.storeys[level])
        for (level,name), items in self.room_references.items():
            self.rooted("IfcRelReferencedInSpatialStructure", f"room-ref:{level}:{name}",
                RelatedElements=items, RelatingStructure=self.spaces[(level,name)])
        for key, members in self.service_members.items():
            system = self.rooted("IfcDistributionSystem", "system:"+key,
                Name=self.info["systems"][key][0], PredefinedType=SERVICE_TYPES[key])
            self.rooted("IfcRelAssignsToGroup", "system-members:"+key, RelatingGroup=system, RelatedObjects=members)
            self.rooted("IfcRelServicesBuildings", "served:"+key, RelatingSystem=system, RelatedBuildings=[self.building])
        for key, members in self.stage_members.items():
            group = self.rooted("IfcGroup", "stage:"+key, Name=self.info["stages"][key], ObjectType="Этап ремонта")
            self.rooted("IfcRelAssignsToGroup", "stage-members:"+key, RelatingGroup=group, RelatedObjects=members)


def verify(path, rows, info):
    """Reopen the actual STEP file and check schema, links, meshes and extents."""
    import ifcopenshell.geom as geom
    import ifcopenshell.validate as validation
    reopened = ifcopenshell.open(str(path))
    if reopened.schema != "IFC4":
        raise ValueError("Wrong schema")
    issues = validation.json_logger()
    validation.validate(reopened, issues, express_rules=True)
    errors = [str(m["message"]) for m in issues.statements if m.get("level") in ("error", "critical")]
    if errors:
        raise ValueError(f"{len(errors)} IFC validation errors: " + " / ".join(errors[:3]))
    if len(reopened.by_type("IfcBuildingStorey")) != 2 or len(reopened.by_type("IfcSpace")) != 14:
        raise ValueError("Spatial structure changed during write")
    origins = {s.Name:s.Elevation for s in reopened.by_type("IfcBuildingStorey")}
    if origins != {"Этаж 1":LEVELS[0], "Этаж 2":LEVELS[1]}:
        raise ValueError("Unexpected floor elevations")
    room_areas = {}
    for space in reopened.by_type("IfcSpace"):
        related = [rel.RelatingPropertyDefinition for rel in space.IsDefinedBy]
        qty = next(q for q in related if q.is_a("IfcElementQuantity") and q.Name == ROOM_AREA)
        room_areas[space.Name] = qty.Quantities[0].AreaValue
        if space.Representation is not None or len(space.Decomposes) != 1:
            raise ValueError(f"Unexpected boundaries or parent for {space.Name}")
    if room_areas != {room[0]:room[2] for room in info["rooms"]}:
        raise ValueError("Room areas differ from source")
    expected_systems = Counter(r["system"] for r in rows if r["system"] in SERVICE_TYPES)
    actual_systems = {s.PredefinedType:sum(len(x.RelatedObjects) for x in s.IsGroupedBy)
                      for s in reopened.by_type("IfcDistributionSystem")}
    if {SERVICE_TYPES[k]:n for k,n in expected_systems.items()} != actual_systems:
        raise ValueError("System membership mismatch")
    expected_elements = {r["id"]:r for r in rows}
    elements = reopened.by_type("IfcElement")
    if len(elements) != len(rows) or {e.Tag for e in elements} != set(expected_elements):
        raise ValueError("Exported element tags differ from the scene")
    settings = geom.settings()
    settings.set("use-world-coords", True)
    max_difference = 0.0
    for element in elements:
        r = expected_elements[element.Tag]
        if element.GlobalId != guid("element:"+r["id"]):
            raise ValueError(f"Changed stable GlobalId on {element.Tag}")
        if len(element.ContainedInStructure) != 1 or element.ContainedInStructure[0].RelatingStructure.Elevation != LEVELS[r["level"]]:
            raise ValueError(f"Wrong storey for {element.Tag}")
        if not any(rel.RelatingPropertyDefinition.Name == CARD for rel in element.IsDefinedBy):
            raise ValueError(f"Missing card for {element.Tag}")
        shape = geom.create_shape(settings, element)
        coords = shape.geometry.verts
        if not coords or not shape.geometry.faces:
            raise ValueError(f"Empty decoded geometry for {element.Tag}")
        native_bounds = bounds(zip(coords[0::3], coords[1::3], coords[2::3]))
        src_bounds = bounds(r["verts"])
        diff = max(abs(a-b) for lhs,rhs in zip(native_bounds,src_bounds) for a,b in zip(lhs,rhs))
        if diff > .001:
            raise ValueError(f"World extents for {element.Tag} deviate by {diff:.6f} m")
        max_difference = max(diff,max_difference)
    stairs = reopened.by_type("IfcStair")
    if len(stairs) != 1 or expected_elements[stairs[0].Tag]["variant"] != "album":
        raise ValueError("Unexpected stair configuration")
    return {
        "schema": reopened.schema, "schema_express_errors": len(errors),
        "spatial_storeys_m": origins, "rooms":len(room_areas),
        "room_areas_m2": round(sum(room_areas.values()),2), "scene_elements":len(elements),
        "bbox_proxies":sum(bool(r["proxy"]) for r in rows), "distribution_system_members":actual_systems,
        "verified_shapes":len(elements), "max_bounds_error_m": round(max_difference,8),
        "triangles_from_source":sum(len(r["faces"]) for r in rows),
        "stair":stairs[0].Tag,
    }


def main():
    global ifcopenshell
    args = arguments()
    if args.ifc_libs.is_dir():
        sys.path.insert(0,str(args.ifc_libs.resolve()))
    try:
        import ifcopenshell
    except ImportError as exc:
        raise SystemExit("IfcOpenShell is required; choose an IFC-enabled Python or pass --ifc-libs.") from exc
    rows, info = read_inputs(args)
    out = args.output.resolve()
    out.parent.mkdir(parents=True,exist_ok=True)
    exchange = Exchange(info)
    for row in rows:
        exchange.element(row)
    exchange.relations()
    header=exchange.model.header
    header.file_description.description=("Apartment design coordination; IFC4 tessellated shapes",)
    header.file_name.name=out.name
    header.file_name.author=("Apartment renovation project",)
    header.file_name.organization=("Apartment renovation project",)
    header.file_name.originating_system="Codex apartment scene exporter"
    # Keep the last verified exchange intact if decoding or validation fails.
    fd,tmp = tempfile.mkstemp(prefix=".ifc-build-",suffix=".ifc",dir=out.parent)
    os.close(fd)
    pending=Path(tmp)
    try:
        exchange.model.write(str(pending))
        stats=verify(pending,rows,info)
        os.replace(pending,out)
    finally:
        pending.unlink(missing_ok=True)
    print(json.dumps({"output":str(out),**stats},ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
