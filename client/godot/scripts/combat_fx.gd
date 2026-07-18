extends Node3D

@export var audio_enabled := true

var audio_player: AudioStreamPlayer
var random := RandomNumberGenerator.new()

func _ready() -> void:
	random.randomize()
	audio_player = AudioStreamPlayer.new()
	audio_player.bus = "Master"
	add_child(audio_player)

func play_burst(world_position: Vector3, color: Color, tone_hz := 440.0, intensity := 1.0) -> void:
	for index in range(int(10 * intensity)):
		_spawn_shard(world_position, color, index, intensity)
	_spawn_ring(world_position, color, intensity)
	if audio_enabled:
		_play_tone(tone_hz, 0.12 + intensity * 0.04, minf(0.75, 0.32 + intensity * 0.12))

func play_duel_impact(world_position: Vector3, winner_color: Color) -> void:
	play_burst(world_position, winner_color, 690.0, 1.8)
	var delayed := get_tree().create_timer(0.12)
	delayed.timeout.connect(func(): play_burst(world_position + Vector3(0, 0.35, 0), Color("f8fafc"), 920.0, 0.8))

func _spawn_shard(origin: Vector3, color: Color, index: int, intensity: float) -> void:
	var shard := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.035 + random.randf_range(0.0, 0.035)
	mesh.height = mesh.radius * 2.0
	shard.mesh = mesh
	shard.position = origin + Vector3(0, 0.18, 0)
	var material := StandardMaterial3D.new()
	material.albedo_color = color.lightened(random.randf_range(0.0, 0.25))
	material.emission_enabled = true
	material.emission = material.albedo_color
	material.emission_energy_multiplier = 2.2
	shard.material_override = material
	add_child(shard)

	var angle := TAU * float(index) / maxf(1.0, 10.0 * intensity) + random.randf_range(-0.25, 0.25)
	var distance := random.randf_range(0.5, 1.1) * intensity
	var destination := origin + Vector3(cos(angle) * distance, random.randf_range(0.35, 1.1) * intensity, sin(angle) * distance)
	var tween := create_tween().set_parallel(true)
	tween.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(shard, "position", destination, 0.5 + random.randf_range(0.0, 0.25))
	tween.tween_property(shard, "scale", Vector3.ZERO, 0.72)
	tween.chain().tween_callback(shard.queue_free)

func _spawn_ring(origin: Vector3, color: Color, intensity: float) -> void:
	var ring := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.16
	mesh.outer_radius = 0.21
	ring.mesh = mesh
	ring.rotation_degrees.x = 90.0
	ring.position = origin + Vector3(0, 0.08, 0)
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.emission_enabled = true
	material.emission = color
	material.emission_energy_multiplier = 2.8
	ring.material_override = material
	add_child(ring)
	var tween := create_tween().set_parallel(true)
	tween.tween_property(ring, "scale", Vector3.ONE * (3.0 + intensity), 0.5)
	tween.tween_property(material, "albedo_color:a", 0.0, 0.5)
	tween.chain().tween_callback(ring.queue_free)

func _play_tone(frequency: float, duration: float, volume: float) -> void:
	var mix_rate := 22050
	var sample_count := int(duration * mix_rate)
	var data := PackedByteArray()
	data.resize(sample_count * 2)
	for sample_index in range(sample_count):
		var progress := float(sample_index) / maxf(1.0, sample_count - 1.0)
		var envelope := pow(1.0 - progress, 2.2)
		var harmonic := sin(TAU * frequency * sample_index / mix_rate)
		harmonic += 0.28 * sin(TAU * frequency * 2.0 * sample_index / mix_rate)
		var value := int(clampf(harmonic * envelope * volume, -1.0, 1.0) * 32767.0)
		data.encode_s16(sample_index * 2, value)
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = mix_rate
	stream.stereo = false
	stream.data = data
	audio_player.stream = stream
	audio_player.play()
