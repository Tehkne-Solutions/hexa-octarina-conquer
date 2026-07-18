extends Control

@onready var network = get_node("../../NetworkSession")

var auth_panel: PanelContainer
var profile_panel: PanelContainer
var data_panel: PanelContainer
var handle_input: LineEdit
var display_input: LineEdit
var password_input: LineEdit
var auth_status: Label
var profile_label: Label
var data_title: Label
var data_content: RichTextLabel

func _ready() -> void:
	set_process_input(true)
	_build_auth_panel()
	_build_profile_panel()
	_build_data_panel()
	network.account_changed.connect(_on_account_changed)
	network.leaderboard_changed.connect(_on_leaderboard_changed)
	network.history_changed.connect(_on_history_changed)
	network.status_changed.connect(_on_status_changed)
	network.state_changed.connect(_on_state_changed)
	_on_account_changed(network.account_profile)

func _build_auth_panel() -> void:
	auth_panel = PanelContainer.new()
	auth_panel.name = "AuthPanel"
	auth_panel.set_anchors_preset(Control.PRESET_CENTER)
	auth_panel.position = Vector2(-190, -185)
	auth_panel.size = Vector2(380, 370)
	add_child(auth_panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 22)
	margin.add_theme_constant_override("margin_top", 20)
	margin.add_theme_constant_override("margin_right", 22)
	margin.add_theme_constant_override("margin_bottom", 20)
	auth_panel.add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	margin.add_child(box)

	var title := Label.new()
	title.text = "IDENTIDADE OCTARINA"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 24)
	box.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Sua conta mantém XP, ranking e histórico."
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(subtitle)

	handle_input = LineEdit.new()
	handle_input.placeholder_text = "Usuário (3–24 caracteres)"
	handle_input.max_length = 24
	box.add_child(handle_input)

	display_input = LineEdit.new()
	display_input.placeholder_text = "Nome exibido"
	display_input.max_length = 32
	box.add_child(display_input)

	password_input = LineEdit.new()
	password_input.placeholder_text = "Senha (mínimo 8 caracteres)"
	password_input.secret = true
	box.add_child(password_input)

	var register_button := Button.new()
	register_button.text = "CRIAR CONTA E JOGAR"
	register_button.pressed.connect(_register)
	box.add_child(register_button)

	var login_button := Button.new()
	login_button.text = "ENTRAR"
	login_button.pressed.connect(_login)
	box.add_child(login_button)

	var guest_button := Button.new()
	guest_button.text = "CONTINUAR COMO VISITANTE"
	guest_button.pressed.connect(_guest)
	box.add_child(guest_button)

	auth_status = Label.new()
	auth_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	auth_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(auth_status)

func _build_profile_panel() -> void:
	profile_panel = PanelContainer.new()
	profile_panel.name = "ProfilePanel"
	profile_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	profile_panel.position = Vector2(-320, 20)
	profile_panel.size = Vector2(300, 185)
	add_child(profile_panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 14)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 14)
	profile_panel.add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 7)
	margin.add_child(box)

	profile_label = Label.new()
	profile_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(profile_label)

	var actions := HBoxContainer.new()
	box.add_child(actions)
	var ranking_button := Button.new()
	ranking_button.text = "Ranking"
	ranking_button.pressed.connect(func(): network.request_leaderboard())
	actions.add_child(ranking_button)
	var history_button := Button.new()
	history_button.text = "Histórico"
	history_button.pressed.connect(func(): network.request_history())
	actions.add_child(history_button)

	var forfeit_button := Button.new()
	forfeit_button.text = "DESISTIR DA PARTIDA"
	forfeit_button.pressed.connect(_forfeit)
	box.add_child(forfeit_button)

func _build_data_panel() -> void:
	data_panel = PanelContainer.new()
	data_panel.name = "DataPanel"
	data_panel.set_anchors_preset(Control.PRESET_CENTER)
	data_panel.position = Vector2(-250, -220)
	data_panel.size = Vector2(500, 440)
	data_panel.visible = false
	add_child(data_panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_top", 18)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_bottom", 18)
	data_panel.add_child(margin)
	var box := VBoxContainer.new()
	margin.add_child(box)
	data_title = Label.new()
	data_title.add_theme_font_size_override("font_size", 22)
	data_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(data_title)
	data_content = RichTextLabel.new()
	data_content.fit_content = false
	data_content.custom_minimum_size = Vector2(450, 330)
	data_content.bbcode_enabled = true
	box.add_child(data_content)
	var close_button := Button.new()
	close_button.text = "FECHAR"
	close_button.pressed.connect(func(): data_panel.visible = false)
	box.add_child(close_button)

func _register() -> void:
	network.register_account(handle_input.text, display_input.text, password_input.text)
	auth_status.text = "Criando conta..."

func _login() -> void:
	network.login_account(handle_input.text, password_input.text)
	auth_status.text = "Autenticando..."

func _guest() -> void:
	auth_panel.visible = false
	profile_panel.visible = false
	network.play_as_guest()

func _forfeit() -> void:
	if network.room_state.get("status", "") == "active":
		network.forfeit_match()

func _on_account_changed(profile: Dictionary) -> void:
	var authenticated := not profile.is_empty()
	auth_panel.visible = not authenticated and network.room_id.is_empty()
	profile_panel.visible = authenticated
	if not authenticated:
		profile_label.text = "Visitante\nSem progressão persistente"
		return
	profile_label.text = "%s (@%s)\nNível %d • XP %d\nRating %d • Rank #%s\n%d vitórias • %d derrotas" % [
		profile.get("displayName", "Jogador"),
		profile.get("handle", ""),
		profile.get("level", 1),
		profile.get("xp", 0),
		profile.get("rating", 1000),
		str(profile.get("rank", "—")),
		profile.get("wins", 0),
		profile.get("losses", 0)
	]

func _on_leaderboard_changed(entries: Array) -> void:
	data_title.text = "RANKING OCTARINA"
	var lines := PackedStringArray()
	for entry in entries:
		lines.append("[b]#%d  %s[/b]  •  %d rating  •  Nv.%d" % [
			entry.get("rank", 0), entry.get("displayName", "Jogador"),
			entry.get("rating", 0), entry.get("level", 1)
		])
	data_content.text = "\n".join(lines)
	data_panel.visible = true

func _on_history_changed(matches: Array) -> void:
	data_title.text = "HISTÓRICO DE BATALHAS"
	var lines := PackedStringArray()
	for match_data in matches:
		var won := match_data.get("winnerAccountId", "") == network.account_id
		var opponent := match_data.get("loserName", "") if won else match_data.get("winnerName", "")
		var delta := match_data.get("winnerRatingDelta", 0) if won else match_data.get("loserRatingDelta", 0)
		lines.append("[b]%s[/b] vs %s  •  Rating %+d  •  %s" % [
			"VITÓRIA" if won else "DERROTA", opponent, delta, match_data.get("reason", "partida")
		])
	data_content.text = "Nenhuma partida registrada." if lines.is_empty() else "\n".join(lines)
	data_panel.visible = true

func _on_status_changed(text: String) -> void:
	if auth_panel.visible:
		auth_status.text = text

func _on_state_changed(state: Dictionary) -> void:
	if not network.room_id.is_empty():
		auth_panel.visible = false
	if state.get("status", "") == "finished" and network.has_account():
		network.request_profile()
		network.request_history()
