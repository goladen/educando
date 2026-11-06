<# : batch
@echo off
set "PIKT_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$s=[IO.File]::ReadAllText($env:PIKT_SELF,[Text.Encoding]::UTF8); Invoke-Expression $s"
exit /b
#>
# =====================================================================
#  PiKT · Gestión informática · Bloqueo de fondos
#  Bloquea / desbloquea el cambio del fondo de escritorio y de la
#  pantalla de bloqueo para TODOS los usuarios del equipo (HKLM).
#  Requiere permisos de administrador (se piden solos al abrirlo).
# =====================================================================

# --- Elevación: si no somos administrador, nos relanzamos como tal ---
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
    try {
        Start-Process -FilePath $env:ComSpec -ArgumentList "/c `"`"$env:PIKT_SELF`"`"" -Verb RunAs -WindowStyle Hidden
    } catch {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show("Este programa necesita permisos de administrador.`nVuelve a abrirlo y acepta el aviso de Windows.", "PiKT · Bloqueo de fondos", 'OK', 'Warning') | Out-Null
    }
    exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$RUTA_FONDO     = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Policies\ActiveDesktop'
$RUTA_BLOQUEO   = 'HKLM:\Software\Policies\Microsoft\Windows\Personalization'

function Poner-Valor($ruta, $nombre) {
    if (-not (Test-Path $ruta)) { New-Item -Path $ruta -Force | Out-Null }
    New-ItemProperty -Path $ruta -Name $nombre -PropertyType DWord -Value 1 -Force | Out-Null
}
function Quitar-Valor($ruta, $nombre) {
    if (Test-Path $ruta) { Remove-ItemProperty -Path $ruta -Name $nombre -ErrorAction SilentlyContinue }
}
function Leer-Valor($ruta, $nombre) {
    try { return (Get-ItemProperty -Path $ruta -Name $nombre -ErrorAction Stop).$nombre } catch { return $null }
}

# --- Ventana ---
$f = New-Object System.Windows.Forms.Form
$f.Text = 'PiKT · Bloqueo de fondos'
$f.Size = New-Object System.Drawing.Size(520, 520)
$f.StartPosition = 'CenterScreen'
$f.FormBorderStyle = 'FixedDialog'
$f.MaximizeBox = $false
$f.BackColor = [System.Drawing.Color]::White
$f.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$titulo = New-Object System.Windows.Forms.Label
$titulo.Text = 'Bloqueo de fondos del equipo'
$titulo.Font = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$titulo.ForeColor = [System.Drawing.Color]::FromArgb(44, 62, 80)
$titulo.Location = New-Object System.Drawing.Point(20, 15)
$titulo.AutoSize = $true
$f.Controls.Add($titulo)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = "Afecta a todas las cuentas de este ordenador ($env:COMPUTERNAME)."
$sub.ForeColor = [System.Drawing.Color]::Gray
$sub.Location = New-Object System.Drawing.Point(22, 50)
$sub.AutoSize = $true
$f.Controls.Add($sub)

$estado = New-Object System.Windows.Forms.Label
$estado.Location = New-Object System.Drawing.Point(22, 80)
$estado.Size = New-Object System.Drawing.Size(470, 60)
$estado.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$f.Controls.Add($estado)

function Refrescar-Estado {
    $fondo = (Leer-Valor $RUTA_FONDO 'NoChangingWallPaper') -eq 1
    $bloq  = (Leer-Valor $RUTA_BLOQUEO 'NoChangingLockScreen') -eq 1
    $sinPB = (Leer-Valor $RUTA_BLOQUEO 'NoLockScreen') -eq 1
    $t  = 'Fondo de escritorio: ' + $(if ($fondo) { 'BLOQUEADO' } else { 'libre' }) + "`n"
    $t += 'Pantalla de bloqueo: ' + $(if ($bloq) { 'BLOQUEADA' } else { 'libre' })
    if ($sinPB) { $t += '  (y oculta: NoLockScreen)' }
    $estado.Text = $t
}

function Nuevo-Boton($texto, $y, $color, $accion) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $texto
    $b.Location = New-Object System.Drawing.Point(22, $y)
    $b.Size = New-Object System.Drawing.Size(460, 44)
    $b.FlatStyle = 'Flat'
    $b.FlatAppearance.BorderSize = 0
    $b.BackColor = $color
    $b.ForeColor = [System.Drawing.Color]::White
    $b.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $b.Cursor = 'Hand'
    $b.Add_Click($accion)
    $f.Controls.Add($b)
}

$rojo  = [System.Drawing.Color]::FromArgb(192, 57, 43)
$verde = [System.Drawing.Color]::FromArgb(39, 174, 96)
$gris  = [System.Drawing.Color]::FromArgb(90, 100, 110)

function Hecho($msg) {
    Refrescar-Estado
    [System.Windows.Forms.MessageBox]::Show("$msg`n`nReinicia el ordenador para que se aplique a las cuentas de los alumnos.", 'Hecho', 'OK', 'Information') | Out-Null
}

Nuevo-Boton '1. Bloquear el cambio del fondo de escritorio' 150 $rojo {
    Poner-Valor $RUTA_FONDO 'NoChangingWallPaper'; Hecho 'Fondo de escritorio bloqueado.'
}
Nuevo-Boton '2. Permitir el cambio del fondo de escritorio' 200 $verde {
    Quitar-Valor $RUTA_FONDO 'NoChangingWallPaper'; Hecho 'Fondo de escritorio desbloqueado.'
}
Nuevo-Boton '3. Bloquear el cambio de la pantalla de bloqueo' 260 $rojo {
    Poner-Valor $RUTA_BLOQUEO 'NoChangingLockScreen'
    if ($chkOcultar.Checked) { Poner-Valor $RUTA_BLOQUEO 'NoLockScreen' }
    Hecho 'Pantalla de bloqueo bloqueada.'
}
Nuevo-Boton '4. Permitir el cambio de la pantalla de bloqueo' 310 $verde {
    Quitar-Valor $RUTA_BLOQUEO 'NoChangingLockScreen'
    Quitar-Valor $RUTA_BLOQUEO 'NoLockScreen'
    Hecho 'Pantalla de bloqueo desbloqueada.'
}

$chkOcultar = New-Object System.Windows.Forms.CheckBox
$chkOcultar.Text = 'Con la opción 3, ocultar además la pantalla de bloqueo (NoLockScreen)'
$chkOcultar.Location = New-Object System.Drawing.Point(24, 362)
$chkOcultar.Size = New-Object System.Drawing.Size(470, 24)
$chkOcultar.ForeColor = $gris
$f.Controls.Add($chkOcultar)

Nuevo-Boton 'Reiniciar el ordenador ahora' 405 $gris {
    $r = [System.Windows.Forms.MessageBox]::Show('¿Reiniciar ahora? Guarda antes cualquier trabajo abierto.', 'Reiniciar', 'YesNo', 'Question')
    if ($r -eq 'Yes') { Restart-Computer -Force }
}

Refrescar-Estado
[void]$f.ShowDialog()
