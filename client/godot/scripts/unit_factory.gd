class_name UnitFactory
extends RefCounted

const ELEMENT_COLORS := {
	"fire": Color("fb7185"),
	"water": Color("60a5fa"),
	"earth": Color("84cc16"),
	"air": Color("facc15"),
	"lightning": Color("c084fc"),
	"neutral": Color("e2e8f0")
}

static func build_unit(parent: Node3D, owner_color: Color, unit: Dictionary, position: Vector3, node_name: String) -> Node3D:
	var root := Node3D.new()
	root.name = node_name
	root.position = position
	parent.add_child(root)
	var level: int = unit.get("level", 1)
	var kind: String = unit.get("kind", "recruit")
	var element: String = unit.get("element", "neutral")
	var accent: Color = ELEMENT_COLORS.get(element, ELEMENT_COLORS["neutral"])
	if kind == "fortress":
		_build_fortress(root, owner_color, accent, level)
	else:
		_build_recruit(root, owner_color, accent, level)
	return root

static func _build_recruit(root: Node3D, owner_color: Color, accent: Color, level: int) -> void:
	var scale_factor := 1.0 + float(level - 1) * 0.09
	_add_mesh(root, _capsule(0.24 * scale_factor, 0.58 * scale_factor), owner_color.darkened(0.08), Vector3(0, 0.46 * scale_factor, 0), 0.28, 0.48)
	_add_mesh(root, _sphere(0.19 * scale_factor), owner_color.lightened(0.22), Vector3(0, 0.94 * scale_factor, 0), 0.15, 0.55)
	var shield := BoxMesh.new()
	shield.size = Vector3(0.36, 0.42, 0.10) * scale_factor
	_add_mesh(root, shield, owner_color.darkened(0.22), Vector3(-0.30, 0.54, 0.03) * scale_factor, 0.62, 0.28)
	var weapon := CylinderMesh.new()
	weapon.top_radius = 0.035
	weapon.bottom_radius = 0.045
	weapon.height = 0.85 * scale_factor
	var weapon_instance := _add_mesh(root, weapon, accent, Vector3(0.30, 0.62, 0) * scale_factor, 0.72, 0.2, true)
	weapon_instance.rotation_degrees.z = -18.0
	_build_banner(root, owner_color, accent, level, Vector3(0, 1.22 * scale_factor, 0))

static func _build_fortress(root: Node3D, owner_color: Color, accent: Color, level: int) -> void:
	var scale_factor := 1.0 + float(level - 1) * 0.08
	var base := BoxMesh.new()
	base.size = Vector3(0.78, 0.50, 0.78) * scale_factor
	_add_mesh(root, base, owner_color.darkened(0.25), Vector3(0, 0.25 * scale_factor, 0), 0.48, 0.4)
	for offset in [Vector3(-0.30, 0, -0.30), Vector3(0.30, 0, -0.30), Vector3(-0.30, 0, 0.30), Vector3(0.30, 0, 0.30)]:
		var tower := CylinderMesh.new()
		tower.top_radius = 0.14 * scale_factor
		tower.bottom_radius = 0.18 * scale_factor
		tower.height = 0.72 * scale_factor
		_add_mesh(root, tower, owner_color, offset * scale_factor + Vector3(0, 0.58 * scale_factor, 0), 0.52, 0.34)
	var core := SphereMesh.new()
	core.radius = 0.16 * scale_factor
	core.height = 0.32 * scale_factor
	_add_mesh(root, core, accent, Vector3(0, 0.76 * scale_factor, 0), 0.36, 0.18, true)
	_build_banner(root, owner_color, accent, level, Vector3(0, 1.18 * scale_factor, 0))

static func _build_banner(root: Node3D, owner_color: Color, accent: Color, level: int, anchor: Vector3) -> void:
	var pole := CylinderMesh.new()
	pole.top_radius = 0.025
	pole.bottom_radius = 0.035
	pole.height = 0.70
	_add_mesh(root, pole, Color("cbd5e1"), anchor + Vector3(0, 0.18, 0), 0.75, 0.18)
	var flag := BoxMesh.new()
	flag.size = Vector3(0.34 + level * 0.025, 0.20, 0.035)
	_add_mesh(root, flag, owner_color.lightened(0.12), anchor + Vector3(0.16, 0.43, 0), 0.25, 0.4, true, accent)

static func _capsule(radius: float, height: float) -> CapsuleMesh:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = maxf(height, radius * 2.1)
	return mesh

static func _sphere(radius: float) -> SphereMesh:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	return mesh

static func _add_mesh(
	parent: Node3D,
	mesh: PrimitiveMesh,
	color: Color,
	position: Vector3,
	metallic: float,
	roughness: float,
	emissive := false,
	emission_color := Color.WHITE
) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = metallic
	material.roughness = roughness
	if emissive:
		material.emission_enabled = true
		material.emission = emission_color if emission_color != Color.WHITE else color
		material.emission_energy_multiplier = 1.15
	instance.material_override = material
	parent.add_child(instance)
	return instance
