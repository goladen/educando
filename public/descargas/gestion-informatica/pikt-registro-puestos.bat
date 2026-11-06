<# : batch
@echo off
set "PIKT_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$s=[IO.File]::ReadAllText($env:PIKT_SELF,[Text.Encoding]::UTF8); Invoke-Expression $s"
exit /b
#>
# =====================================================================
#  PiKT · Gestión informática · Registro de puestos
#  Panel de administración: instala en el equipo un programa que, al
#  iniciar sesión, pide nombre y curso, lo muestra siempre visible en
#  pantalla y guarda en un registro quién usó el ordenador y cuándo.
#  Requiere permisos de administrador (se piden solos al abrirlo).
# =====================================================================

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    try {
        Start-Process -FilePath $env:ComSpec -ArgumentList "/c `"`"$env:PIKT_SELF`"`"" -Verb RunAs -WindowStyle Hidden
    } catch {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show("Este programa necesita permisos de administrador.`nVuelve a abrirlo y acepta el aviso de Windows.", 'PiKT · Registro de puestos', 'OK', 'Warning') | Out-Null
    }
    exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$DIR      = Join-Path $env:ProgramData 'PiktPuesto'
$SCRIPT   = Join-Path $DIR 'puesto.ps1'
$VBS      = Join-Path $DIR 'lanzar.vbs'
$CONFIG   = Join-Path $DIR 'config.json'
$LOG      = Join-Path $DIR 'registro.csv'
$RUN_KEY  = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'
$RUN_NAME = 'PiktPuesto'
$CABECERA = 'Evento;Fecha;Hora;Equipo;UsuarioWindows;Nombre;Curso;Sesion;Duracion'
$CURSOS_DEF = @('1º ESO', '2º ESO', '3º ESO', '4º ESO', '1º Bachillerato', '2º Bachillerato', 'FP Básica', 'Ciclo Formativo', 'Profesorado', 'Otro')

# ---------------------------------------------------------------------
#  Programa que se ejecuta en cada inicio de sesión (se copia al equipo)
# ---------------------------------------------------------------------
$PUESTO_PS1 = @'
# PiKT · Registro de puestos · se ejecuta al iniciar sesión (no editar)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$DIR = Join-Path $env:ProgramData 'PiktPuesto'
$LOG = Join-Path $DIR 'registro.csv'

# Una sola instancia por sesión
$mutexCreado = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\PiktPuestoRegistro', [ref]$mutexCreado)
if (-not $mutexCreado) { exit }

$cfg = $null
try { $cfg = [IO.File]::ReadAllText((Join-Path $DIR 'config.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json } catch {}
$cursos   = @('1º ESO', '2º ESO', '3º ESO', '4º ESO', '1º Bachillerato', '2º Bachillerato', 'Otro')
$posicion = 'arriba-centro'
$excluirAdmins = $true
if ($cfg) {
    if ($cfg.cursos) { $cursos = @($cfg.cursos) }
    if ($cfg.posicion) { $posicion = [string]$cfg.posicion }
    if ($null -ne $cfg.excluirAdmins) { $excluirAdmins = [bool]$cfg.excluirAdmins }
}

$ident = [Security.Principal.WindowsIdentity]::GetCurrent()
if ($excluirAdmins -and ($ident.Groups | Where-Object { $_.Value -eq 'S-1-5-32-544' })) { exit }

$script:nombre = ''
$script:curso = ''
$script:inicio = Get-Date
$script:sesion = ([guid]::NewGuid().ToString('N')).Substring(0, 8)
$script:salidaEscrita = $false

function Limpiar($t) { return ([string]$t).Replace(';', ',').Replace("`r", ' ').Replace("`n", ' ').Trim() }

function Escribir-Registro($evento) {
    $ahora = Get-Date
    $dur = ''
    if ($evento -ne 'ENTRADA') {
        $ts = $ahora - $script:inicio
        $dur = '{0:00}:{1:00}' -f [math]::Floor($ts.TotalHours), $ts.Minutes
    }
    $campos = @($evento, $ahora.ToString('yyyy-MM-dd'), $ahora.ToString('HH:mm:ss'), $env:COMPUTERNAME, $env:USERNAME,
                (Limpiar $script:nombre), (Limpiar $script:curso), $script:sesion, $dur)
    $bytes = [Text.Encoding]::UTF8.GetBytes(($campos -join ';') + "`r`n")
    try {
        # Los alumnos solo tienen permiso de AÑADIR al registro (no leer ni borrar)
        $fs = New-Object IO.FileStream($LOG, [IO.FileMode]::Append,
              [Security.AccessControl.FileSystemRights]::AppendData, [IO.FileShare]::ReadWrite, 4096, [IO.FileOptions]::WriteThrough)
        $fs.Write($bytes, 0, $bytes.Length)
        $fs.Close()
    } catch {
        try {
            $alt = Join-Path $env:LOCALAPPDATA 'PiktPuesto'
            if (-not (Test-Path $alt)) { New-Item -ItemType Directory -Path $alt -Force | Out-Null }
            [IO.File]::AppendAllText((Join-Path $alt 'registro-pendiente.csv'), (($campos -join ';') + "`r`n"), [Text.Encoding]::UTF8)
        } catch {}
    }
}

function Registrar-Salida {
    if ($script:salidaEscrita -or -not $script:nombre) { return }
    $script:salidaEscrita = $true
    Escribir-Registro 'SALIDA'
}

# ---------- 1) Pantalla de identificación ----------
$azul = [System.Drawing.Color]::FromArgb(30, 41, 59)
$fi = New-Object System.Windows.Forms.Form
$fi.FormBorderStyle = 'None'
$fi.WindowState = 'Maximized'
$fi.TopMost = $true
$fi.ShowInTaskbar = $false
$fi.BackColor = $azul
$fi.KeyPreview = $true

$panel = New-Object System.Windows.Forms.Panel
$panel.Size = New-Object System.Drawing.Size(520, 330)
$panel.BackColor = [System.Drawing.Color]::White
$fi.Controls.Add($panel)

$l1 = New-Object System.Windows.Forms.Label
$l1.Text = '¿Quién usa este ordenador?'
$l1.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
$l1.ForeColor = $azul
$l1.Location = New-Object System.Drawing.Point(30, 22); $l1.AutoSize = $true
$panel.Controls.Add($l1)

$l2 = New-Object System.Windows.Forms.Label
$l2.Text = "Equipo $env:COMPUTERNAME · Tu nombre quedará visible en pantalla y registrado."
$l2.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$l2.ForeColor = [System.Drawing.Color]::Gray
$l2.Location = New-Object System.Drawing.Point(32, 64); $l2.AutoSize = $true
$panel.Controls.Add($l2)

$fuente = New-Object System.Drawing.Font('Segoe UI', 12)
$ln = New-Object System.Windows.Forms.Label
$ln.Text = 'Nombre y apellidos'; $ln.Font = $fuente
$ln.Location = New-Object System.Drawing.Point(30, 100); $ln.AutoSize = $true
$panel.Controls.Add($ln)
$tn = New-Object System.Windows.Forms.TextBox
$tn.Font = $fuente; $tn.MaxLength = 60
$tn.Location = New-Object System.Drawing.Point(30, 128); $tn.Size = New-Object System.Drawing.Size(460, 30)
$panel.Controls.Add($tn)

$lc = New-Object System.Windows.Forms.Label
$lc.Text = 'Curso / grupo'; $lc.Font = $fuente
$lc.Location = New-Object System.Drawing.Point(30, 170); $lc.AutoSize = $true
$panel.Controls.Add($lc)
$cc = New-Object System.Windows.Forms.ComboBox
$cc.Font = $fuente; $cc.DropDownStyle = 'DropDown'; $cc.MaxLength = 30
$cc.Location = New-Object System.Drawing.Point(30, 198); $cc.Size = New-Object System.Drawing.Size(460, 30)
foreach ($c in $cursos) { [void]$cc.Items.Add($c) }
$panel.Controls.Add($cc)

$err = New-Object System.Windows.Forms.Label
$err.ForeColor = [System.Drawing.Color]::FromArgb(192, 57, 43)
$err.Location = New-Object System.Drawing.Point(30, 236); $err.Size = New-Object System.Drawing.Size(460, 20)
$panel.Controls.Add($err)

$be = New-Object System.Windows.Forms.Button
$be.Text = 'Entrar'
$be.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$be.BackColor = [System.Drawing.Color]::FromArgb(37, 99, 235); $be.ForeColor = [System.Drawing.Color]::White
$be.FlatStyle = 'Flat'; $be.FlatAppearance.BorderSize = 0
$be.Location = New-Object System.Drawing.Point(30, 262); $be.Size = New-Object System.Drawing.Size(460, 44)
$panel.Controls.Add($be)
$fi.AcceptButton = $be

$fi.Add_Shown({
    $panel.Left = [int](($fi.ClientSize.Width - $panel.Width) / 2)
    $panel.Top  = [int](($fi.ClientSize.Height - $panel.Height) / 2)
    $fi.Activate(); $tn.Focus()
})
$script:identificado = $false
$be.Add_Click({
    $n = $tn.Text.Trim(); $c = $cc.Text.Trim()
    if ($n.Length -lt 3 -or $n -notmatch '\s') { $err.Text = 'Escribe tu nombre y al menos un apellido.'; $tn.Focus(); return }
    if ($c.Length -lt 1) { $err.Text = 'Indica tu curso o grupo.'; $cc.Focus(); return }
    $script:nombre = $n; $script:curso = $c; $script:identificado = $true
    $fi.Close()
})
$fi.Add_FormClosing({
    param($s, $e)
    if (-not $script:identificado -and $e.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) { $e.Cancel = $true }
})
# Mantener la ventana delante mientras no se identifica
$tf = New-Object System.Windows.Forms.Timer
$tf.Interval = 1500
$tf.Add_Tick({ if (-not $script:identificado -and -not $fi.ContainsFocus) { $fi.TopMost = $true; $fi.Activate() } })
$tf.Start()
[void]$fi.ShowDialog()
$tf.Stop()
if (-not $script:identificado) { exit }   # se cerró la sesión sin identificarse

$script:inicio = Get-Date
Escribir-Registro 'ENTRADA'

# ---------- 2) Etiqueta siempre visible (no se puede pulsar ni mover) ----------
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @"
using System;
using System.Windows.Forms;
using System.Runtime.InteropServices;
public class PiktEtiqueta : Form {
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr d, int x, int y, int cx, int cy, uint f);
    public bool PuedeCerrar = false;
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams {
        get {
            CreateParams cp = base.CreateParams;
            // LAYERED | TRANSPARENT (los clics la atraviesan) | TOOLWINDOW | NOACTIVATE | TOPMOST
            cp.ExStyle |= 0x80000 | 0x20 | 0x80 | 0x08000000 | 0x8;
            return cp;
        }
    }
    public void Encima() { SetWindowPos(this.Handle, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010); }
}
"@

$fo = New-Object PiktEtiqueta
$fo.FormBorderStyle = 'None'
$fo.ShowInTaskbar = $false
$fo.TopMost = $true
$fo.StartPosition = 'Manual'
$fo.BackColor = [System.Drawing.Color]::FromArgb(17, 24, 39)
$fo.Opacity = 0.88
$fo.AutoSize = $true
$fo.AutoSizeMode = 'GrowAndShrink'
$fo.Padding = New-Object System.Windows.Forms.Padding(14, 6, 14, 6)

$lab = New-Object System.Windows.Forms.Label
$lab.AutoSize = $true
$lab.ForeColor = [System.Drawing.Color]::White
$lab.Font = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$lab.Text = "$($script:nombre)  ·  $($script:curso)"
$fo.Controls.Add($lab)

$lab2 = New-Object System.Windows.Forms.Label
$lab2.AutoSize = $true
$lab2.ForeColor = [System.Drawing.Color]::FromArgb(203, 213, 225)
$lab2.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$lab2.Text = "$env:COMPUTERNAME  ·  desde las $($script:inicio.ToString('HH:mm'))"
$lab2.Top = $lab.PreferredHeight
$fo.Controls.Add($lab2)

function Colocar {
    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $m = 6
    switch ($posicion) {
        'arriba-izquierda' { $x = $wa.Left + $m;                    $y = $wa.Top + $m }
        'arriba-derecha'   { $x = $wa.Right - $fo.Width - $m;       $y = $wa.Top + $m }
        'abajo-izquierda'  { $x = $wa.Left + $m;                    $y = $wa.Bottom - $fo.Height - $m }
        'abajo-derecha'    { $x = $wa.Right - $fo.Width - $m;       $y = $wa.Bottom - $fo.Height - $m }
        default            { $x = $wa.Left + [int](($wa.Width - $fo.Width) / 2); $y = $wa.Top + $m }
    }
    $fo.Location = New-Object System.Drawing.Point($x, $y)
}

$fo.Add_Shown({ Colocar; $fo.Encima() })
$fo.Add_FormClosing({
    param($s, $e)
    if ($e.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing) { $e.Cancel = $true; return }
    Registrar-Salida   # cierre de sesión, apagado o cierre desde el Administrador de tareas
})

$to = New-Object System.Windows.Forms.Timer
$to.Interval = 2000
$to.Add_Tick({ Colocar; $fo.Encima() })   # recoloca si cambia la resolución
$to.Start()

[System.Windows.Forms.Application]::Run($fo)
Registrar-Salida
'@

$LANZAR_VBS = @"
' PiKT · Registro de puestos · lanza puesto.ps1 sin ventana de consola
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$SCRIPT""", 0, False
"@

# ---------------------------------------------------------------------
#  Utilidades del panel
# ---------------------------------------------------------------------
function Esta-Instalado { return (Test-Path $SCRIPT) -and ($null -ne (Get-ItemProperty -Path $RUN_KEY -Name $RUN_NAME -ErrorAction SilentlyContinue)) }

function Leer-Config {
    try { return [IO.File]::ReadAllText($CONFIG, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch { return $null }
}

function Instalar($cursos, $posicion, $excluirAdmins) {
    if (-not (Test-Path $DIR)) { New-Item -ItemType Directory -Path $DIR -Force | Out-Null }
    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
    [IO.File]::WriteAllText($SCRIPT, $PUESTO_PS1, $utf8Bom)
    [IO.File]::WriteAllText($VBS, $LANZAR_VBS, [Text.Encoding]::Default)
    $cfg = [ordered]@{ cursos = @($cursos); posicion = $posicion; excluirAdmins = $excluirAdmins }
    [IO.File]::WriteAllText($CONFIG, ($cfg | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    if (-not (Test-Path $LOG)) { [IO.File]::WriteAllText($LOG, $CABECERA + "`r`n", $utf8Bom) }

    # Permisos (por SID, válidos en Windows en cualquier idioma):
    #   carpeta → administradores y SYSTEM control total; usuarios solo lectura
    #   registro.csv → usuarios solo pueden AÑADIR líneas (ni leer, ni borrar, ni modificar)
    & icacls.exe $DIR /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
    & icacls.exe $LOG /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' '*S-1-5-32-545:(AD,RA,S)' | Out-Null

    New-ItemProperty -Path $RUN_KEY -Name $RUN_NAME -PropertyType String -Value "wscript.exe `"$VBS`"" -Force | Out-Null
}

function Detener-Instancias {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*PiktPuesto\puesto.ps1*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Desinstalar($borrarRegistro) {
    Remove-ItemProperty -Path $RUN_KEY -Name $RUN_NAME -ErrorAction SilentlyContinue
    Detener-Instancias
    foreach ($p in @($SCRIPT, $VBS, $CONFIG)) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
    if ($borrarRegistro) { Remove-Item $DIR -Recurse -Force -ErrorAction SilentlyContinue }
}

function Leer-Registro {
    $t = New-Object System.Data.DataTable
    foreach ($c in $CABECERA.Split(';')) { [void]$t.Columns.Add($c) }
    if (-not (Test-Path $LOG)) { return $t }
    $lineas = [IO.File]::ReadAllLines($LOG, [Text.Encoding]::UTF8)
    for ($i = $lineas.Length - 1; $i -ge 1; $i--) {   # más recientes primero, sin la cabecera
        $p = $lineas[$i].Split(';')
        if ($p.Length -lt 8) { continue }
        $r = $t.NewRow()
        for ($k = 0; $k -lt $t.Columns.Count -and $k -lt $p.Length; $k++) { $r[$k] = $p[$k] }
        $t.Rows.Add($r)
    }
    return $t
}

function Ver-Registro {
    $tabla = Leer-Registro
    $fv = New-Object System.Windows.Forms.Form
    $fv.Text = "Registro de puestos · $env:COMPUTERNAME"
    $fv.Size = New-Object System.Drawing.Size(1000, 600)
    $fv.StartPosition = 'CenterScreen'
    $fv.Font = New-Object System.Drawing.Font('Segoe UI', 10)

    $top = New-Object System.Windows.Forms.Panel
    $top.Dock = 'Top'; $top.Height = 44
    $fv.Controls.Add($top)
    $lb = New-Object System.Windows.Forms.Label
    $lb.Text = 'Buscar (nombre, curso, fecha, usuario):'; $lb.AutoSize = $true
    $lb.Location = New-Object System.Drawing.Point(10, 13)
    $top.Controls.Add($lb)
    $tb = New-Object System.Windows.Forms.TextBox
    $tb.Location = New-Object System.Drawing.Point(270, 10); $tb.Size = New-Object System.Drawing.Size(300, 26)
    $top.Controls.Add($tb)
    $cnt = New-Object System.Windows.Forms.Label
    $cnt.AutoSize = $true; $cnt.ForeColor = [System.Drawing.Color]::Gray
    $cnt.Location = New-Object System.Drawing.Point(590, 13)
    $top.Controls.Add($cnt)

    $g = New-Object System.Windows.Forms.DataGridView
    $g.Dock = 'Fill'; $g.ReadOnly = $true; $g.AllowUserToAddRows = $false; $g.RowHeadersVisible = $false
    $g.AutoSizeColumnsMode = 'Fill'; $g.SelectionMode = 'FullRowSelect'; $g.BackgroundColor = [System.Drawing.Color]::White
    $g.DataSource = $tabla
    $fv.Controls.Add($g); $g.BringToFront()

    $actualizar = {
        $q = $tb.Text.Trim().Replace("'", "''").Replace('[', '[[]').Replace('%', '[%]').Replace('*', '[*]')
        if ($q) {
            $tabla.DefaultView.RowFilter = "Nombre LIKE '%$q%' OR Curso LIKE '%$q%' OR Fecha LIKE '%$q%' OR UsuarioWindows LIKE '%$q%' OR Evento LIKE '%$q%'"
        } else { $tabla.DefaultView.RowFilter = '' }
        $cnt.Text = "$($tabla.DefaultView.Count) de $($tabla.Rows.Count) líneas"
    }
    $tb.Add_TextChanged($actualizar)
    $g.Add_DataBindingComplete({
        foreach ($row in $g.Rows) {
            if ($row.Cells['Evento'].Value -eq 'ENTRADA') { $row.DefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(22, 101, 52) }
            else { $row.DefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(153, 27, 27) }
        }
    })
    & $actualizar
    [void]$fv.ShowDialog()
}

# ---------------------------------------------------------------------
#  Ventana principal
# ---------------------------------------------------------------------
$cfgActual = Leer-Config

$f = New-Object System.Windows.Forms.Form
$f.Text = 'PiKT · Registro de puestos'
$f.Size = New-Object System.Drawing.Size(560, 700)
$f.StartPosition = 'CenterScreen'
$f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false
$f.BackColor = [System.Drawing.Color]::White
$f.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$t = New-Object System.Windows.Forms.Label
$t.Text = 'Registro de puestos'
$t.Font = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$t.ForeColor = [System.Drawing.Color]::FromArgb(44, 62, 80)
$t.Location = New-Object System.Drawing.Point(20, 14); $t.AutoSize = $true
$f.Controls.Add($t)

$d = New-Object System.Windows.Forms.Label
$d.Text = "Al iniciar sesión se pide nombre y curso, se muestra siempre en pantalla`ny se registra la entrada y la salida. Equipo: $env:COMPUTERNAME"
$d.ForeColor = [System.Drawing.Color]::Gray
$d.Location = New-Object System.Drawing.Point(22, 48); $d.Size = New-Object System.Drawing.Size(510, 40)
$f.Controls.Add($d)

$est = New-Object System.Windows.Forms.Label
$est.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$est.Location = New-Object System.Drawing.Point(22, 92); $est.Size = New-Object System.Drawing.Size(510, 22)
$f.Controls.Add($est)

$lcur = New-Object System.Windows.Forms.Label
$lcur.Text = 'Cursos que aparecen en la lista (uno por línea):'
$lcur.Location = New-Object System.Drawing.Point(22, 122); $lcur.AutoSize = $true
$f.Controls.Add($lcur)
$tc = New-Object System.Windows.Forms.TextBox
$tc.Multiline = $true; $tc.ScrollBars = 'Vertical'
$tc.Location = New-Object System.Drawing.Point(22, 146); $tc.Size = New-Object System.Drawing.Size(500, 120)
$cursosIni = if ($cfgActual -and $cfgActual.cursos) { @($cfgActual.cursos) } else { $CURSOS_DEF }
$tc.Text = ($cursosIni -join "`r`n")
$f.Controls.Add($tc)

$lpos = New-Object System.Windows.Forms.Label
$lpos.Text = 'Posición del nombre en pantalla:'
$lpos.Location = New-Object System.Drawing.Point(22, 278); $lpos.AutoSize = $true
$f.Controls.Add($lpos)
$cp = New-Object System.Windows.Forms.ComboBox
$cp.DropDownStyle = 'DropDownList'
$cp.Location = New-Object System.Drawing.Point(250, 274); $cp.Size = New-Object System.Drawing.Size(272, 26)
foreach ($o in @('arriba-centro', 'arriba-derecha', 'arriba-izquierda', 'abajo-derecha', 'abajo-izquierda')) { [void]$cp.Items.Add($o) }
$cp.SelectedItem = if ($cfgActual -and $cfgActual.posicion) { [string]$cfgActual.posicion } else { 'arriba-centro' }
if ($cp.SelectedIndex -lt 0) { $cp.SelectedIndex = 0 }
$f.Controls.Add($cp)

$ca = New-Object System.Windows.Forms.CheckBox
$ca.Text = 'No pedir identificación a las cuentas de administrador'
$ca.Location = New-Object System.Drawing.Point(22, 308); $ca.Size = New-Object System.Drawing.Size(500, 24)
$ca.Checked = if ($cfgActual -and $null -ne $cfgActual.excluirAdmins) { [bool]$cfgActual.excluirAdmins } else { $true }
$f.Controls.Add($ca)

function Refrescar {
    if (Esta-Instalado) {
        $est.Text = 'Estado: INSTALADO (se ejecuta en cada inicio de sesión)'
        $est.ForeColor = [System.Drawing.Color]::FromArgb(22, 101, 52)
    } else {
        $est.Text = 'Estado: no instalado'
        $est.ForeColor = [System.Drawing.Color]::FromArgb(153, 27, 27)
    }
}

function Boton($texto, $y, $color, $accion) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $texto
    $b.Location = New-Object System.Drawing.Point(22, $y); $b.Size = New-Object System.Drawing.Size(500, 42)
    $b.FlatStyle = 'Flat'; $b.FlatAppearance.BorderSize = 0
    $b.BackColor = $color; $b.ForeColor = [System.Drawing.Color]::White
    $b.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $b.Cursor = 'Hand'
    $b.Add_Click($accion)
    $f.Controls.Add($b)
}
$azul  = [System.Drawing.Color]::FromArgb(37, 99, 235)
$verde = [System.Drawing.Color]::FromArgb(39, 174, 96)
$rojo  = [System.Drawing.Color]::FromArgb(192, 57, 43)
$gris  = [System.Drawing.Color]::FromArgb(90, 100, 110)

Boton 'Instalar / actualizar en este equipo' 345 $verde {
    $lista = @($tc.Lines | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($lista.Count -eq 0) { $lista = $CURSOS_DEF }
    try {
        Instalar $lista ([string]$cp.SelectedItem) $ca.Checked
        Refrescar
        [System.Windows.Forms.MessageBox]::Show("Instalado. A partir del próximo inicio de sesión se pedirá nombre y curso.`n`nRegistro: $LOG", 'Hecho', 'OK', 'Information') | Out-Null
    } catch {
        [System.Windows.Forms.MessageBox]::Show("No se pudo instalar:`n$($_.Exception.Message)", 'Error', 'OK', 'Error') | Out-Null
    }
}
Boton 'Ver el registro de uso' 395 $azul { Ver-Registro }
Boton 'Exportar el registro al Escritorio (CSV para Excel)' 445 $azul {
    if (-not (Test-Path $LOG)) { [System.Windows.Forms.MessageBox]::Show('Todavía no hay registro.', 'Registro') | Out-Null; return }
    $dest = Join-Path ([Environment]::GetFolderPath('Desktop')) ("registro-puestos-$env:COMPUTERNAME-" + (Get-Date -Format 'yyyyMMdd-HHmm') + '.csv')
    Copy-Item $LOG $dest -Force
    [System.Windows.Forms.MessageBox]::Show("Copiado en:`n$dest", 'Exportado', 'OK', 'Information') | Out-Null
}
Boton 'Probar ahora (abre la identificación en esta sesión)' 495 $gris {
    if (-not (Esta-Instalado)) { [System.Windows.Forms.MessageBox]::Show('Primero instálalo.', 'Probar') | Out-Null; return }
    $cfgP = Leer-Config
    if ($cfgP -and $cfgP.excluirAdmins) {
        [System.Windows.Forms.MessageBox]::Show("Está marcado «No pedir identificación a administradores», así que en tu cuenta no aparecerá.`nDesmárcalo e instala de nuevo para probarlo, o inicia sesión con una cuenta de alumno.", 'Probar', 'OK', 'Information') | Out-Null
        return
    }
    Start-Process wscript.exe -ArgumentList "`"$VBS`""
}
Boton 'Vaciar el registro (guarda antes una copia)' 545 $rojo {
    if (-not (Test-Path $LOG)) { return }
    $r = [System.Windows.Forms.MessageBox]::Show('¿Vaciar el registro? Se guardará una copia con la fecha en la misma carpeta.', 'Vaciar', 'YesNo', 'Warning')
    if ($r -ne 'Yes') { return }
    Copy-Item $LOG (Join-Path $DIR ('registro-' + (Get-Date -Format 'yyyyMMdd-HHmm') + '.csv')) -Force
    [IO.File]::WriteAllText($LOG, $CABECERA + "`r`n", (New-Object System.Text.UTF8Encoding($true)))
    [System.Windows.Forms.MessageBox]::Show('Registro vaciado.', 'Hecho') | Out-Null
}
Boton 'Desinstalar de este equipo' 595 $gris {
    $r = [System.Windows.Forms.MessageBox]::Show("¿Desinstalar?`n`nSí = desinstalar y CONSERVAR el registro`nNo = desinstalar y BORRAR también el registro`nCancelar = no hacer nada", 'Desinstalar', 'YesNoCancel', 'Question')
    if ($r -eq 'Cancel') { return }
    Desinstalar ($r -eq 'No')
    Refrescar
    [System.Windows.Forms.MessageBox]::Show('Desinstalado.', 'Hecho') | Out-Null
}

Refrescar
[void]$f.ShowDialog()
