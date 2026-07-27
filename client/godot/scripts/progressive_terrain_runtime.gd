class_name ProgressiveTerrainRuntimeService
extends Node

const RUNTIME_ROOT := "res://assets/progressive/PACK_01_TERRAIN_CORE"
const REGISTRY_PATH := RUNTIME_ROOT + "/registry/terrain-runtime.json"
const PACK_ID := "HOC_PACK_01_TERRAIN_CORE_FINAL"
const EXPECTED_ASSETS := 103
const SIGNATURE := "Tehkné Solutions"

var _assets_by_id: Dictionary = {}
var _runtime_available := false
var _load_error := ""
var _texture_cache: Dictionary = {}

func _ready() -> void:
	reload_registry()

func reload_registry() -> bool:
	_assets_by_id.clear()
	_texture_cache.clear()
	_runtime_available = false
	_load_error = ""
	if not FileAccess.file_exists(REGISTRY_PATH):
		_load_error = "PACK 01 progressivo não instalado."
		return false
	var file := FileAccess.open(REGISTRY_PATH, FileAccess.READ)
	if file == null:
		_load_error = "Não foi possível abrir %s." % REGISTRY_PATH
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		_load_error = "Registro progressivo de terreno inválido."
		return false
	var registry: Dictionary = parsed
	if registry.get("packId", "") != PACK_ID:
		_load_error = "Registro não pertence ao PACK 01."
		return false
	if registry.get("signature", "") != SIGNATURE:
		_load_error = "Assinatura do PACK 01 inválida."
		return false
	if registry.get("status", "") != "installed-progressive":
		_load_error = "PACK 01 não está em staging progressivo."
		return false
	var assets: Array = registry.get("assets", [])
	if int(registry.get("assetCount", 0)) != EXPECTED_ASSETS or assets.size() != EXPECTED_ASSETS:
		_load_error = "PACK 01 precisa conter exatamente 103 assets."
		return false
	if not registry.get("unresolved", []).is_empty():
		_load_error = "PACK 01 contém referências não resolvidas."
		return false
	for asset in assets:
		if typeof(asset) != TYPE_DICTIONARY:
			_load_error = "PACK 01 contém entrada de asset inválida."
			_assets_by_id.clear()
			return false
		var asset_id: String = asset.get("id", "")
		if asset_id.is_empty() or _assets_by_id.has(asset_id):
			_load_error = "PACK 01 contém ID vazio ou duplicado."
			_assets_by_id.clear()
			return false
		_assets_by_id[asset_id] = asset
	_runtime_available = _assets_by_id.size() == EXPECTED_ASSETS
	return _runtime_available

func has_runtime() -> bool:
	return _runtime_available

func get_load_error() -> String:
	return _load_error

func has_asset(asset_id: String) -> bool:
	return _assets_by_id.has(asset_id)

func get_asset(asset_id: String) -> Dictionary:
	return _assets_by_id.get(asset_id, {})

func get_asset_res_path(asset_id: String, field := "file") -> String:
	var asset: Dictionary = get_asset(asset_id)
	if asset.is_empty():
		return ""
	var runtime_key := "_runtime%s%s" % [field.left(1).to_upper(), field.substr(1)]
	var relative_path: String = asset.get(runtime_key, "")
	if relative_path.is_empty():
		return ""
	return "%s/%s" % [RUNTIME_ROOT, relative_path]

func load_texture(asset_id: String, field := "file") -> Texture2D:
	var cache_key := "%s:%s" % [asset_id, field]
	if _texture_cache.has(cache_key):
		return _texture_cache[cache_key]
	var resource_path := get_asset_res_path(asset_id, field)
	if resource_path.is_empty() or not ResourceLoader.exists(resource_path):
		return null
	var texture := load(resource_path) as Texture2D
	if texture != null:
		_texture_cache[cache_key] = texture
	return texture

func center_asset_id(terrain_id: String, variation_index := 0) -> String:
	var prefix := "GRASS"
	match terrain_id:
		"TERRAIN_RUNIC_STONE": prefix = "RUNIC"
		"TERRAIN_FOREST": prefix = "FOREST"
		"TERRAIN_CORRUPTED": prefix = "CORRUPTED"
		"TERRAIN_SHALLOW_WATER": prefix = "WATER"
		"TERRAIN_LAVA": prefix = "LAVA"
	var variation := ["A", "B", "C"][absi(variation_index) % 3]
	return "TILE_%s_FLAT_CENTER_%s_01" % [prefix, variation]

func create_ground_tile(terrain_id := "TERRAIN_GRASS_ANCESTRAL", variation_index := 0, pixel_size := 0.0021) -> Sprite3D:
	var asset_id := center_asset_id(terrain_id, variation_index)
	var texture := load_texture(asset_id)
	if texture == null:
		return null
	var sprite := Sprite3D.new()
	sprite.name = "ProgressiveTerrain"
	sprite.texture = texture
	sprite.pixel_size = pixel_size
	sprite.centered = true
	sprite.billboard = BaseMaterial3D.BILLBOARD_DISABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.set_meta("progressive_pack_id", PACK_ID)
	sprite.set_meta("progressive_asset_id", asset_id)
	return sprite
