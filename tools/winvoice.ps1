param([string]$Text,[string]$Out,[string]$Voice="David",[int]$Rate=0,[string]$Json)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft $Voice Desktop")
$s.Rate = $Rate
$s.SetOutputToWaveFile($Out)
Register-ObjectEvent $s VisemeReached -SourceIdentifier vz | Out-Null
Register-ObjectEvent $s SpeakProgress -SourceIdentifier wd | Out-Null
$s.Speak($Text)
$s.SetOutputToNull()
$v = @(Get-Event -SourceIdentifier vz | % { @{t=[math]::Round($_.SourceEventArgs.AudioPosition.TotalSeconds,3); v=[int]$_.SourceEventArgs.Viseme} })
$w = @(Get-Event -SourceIdentifier wd | % { @{t=[math]::Round($_.SourceEventArgs.AudioPosition.TotalSeconds,3); w=$_.SourceEventArgs.Text} })
@{visemes=$v; words=$w} | ConvertTo-Json -Depth 4 -Compress | Set-Content -Encoding utf8 $Json
$s.Dispose()
