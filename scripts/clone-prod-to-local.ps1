param(
	[string]$PublicDumpFile = "data/prod.public-data.dump",
	[string]$AuthDumpFile = "data/prod.auth-data.dump",
	[string]$StorageTempDir = "C:\tmp\s3-clone",
	[string]$EnvFile = ".env.local",
	[string]$Buckets = $env:STORAGE_BUCKETS,
	[switch]$SkipDb,
	[switch]$SkipStorage,
	[switch]$SkipLocalReset,
	[switch]$UseSupabaseReset,
	[switch]$AssumeYes
)

$ErrorActionPreference = "Stop"

function Import-DotEnvFile($Path) {
	if ([string]::IsNullOrWhiteSpace($Path)) {
		return
	}
	if (-not (Test-Path -LiteralPath $Path)) {
		return
	}

	$Lines = Get-Content -LiteralPath $Path
	foreach ($Line in $Lines) {
		$Trimmed = $Line.Trim()
		if (-not $Trimmed -or $Trimmed.StartsWith("#")) {
			continue
		}
		$SeparatorIndex = $Trimmed.IndexOf("=")
		if ($SeparatorIndex -le 0) {
			continue
		}

		$Name = $Trimmed.Substring(0, $SeparatorIndex).Trim()
		$Value = $Trimmed.Substring($SeparatorIndex + 1).Trim()
		if (-not $Name -or $Name.StartsWith("export ")) {
			$Name = $Name.Replace("export ", "").Trim()
		}
		if (-not $Name) {
			continue
		}

		if (
			($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
			($Value.StartsWith("'") -and $Value.EndsWith("'"))
		) {
			$Value = $Value.Substring(1, $Value.Length - 2)
		}

		if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
			[Environment]::SetEnvironmentVariable($Name, $Value, "Process")
		}
	}
}

function Require-Env($Name) {
	$Value = [Environment]::GetEnvironmentVariable($Name)
	if ([string]::IsNullOrWhiteSpace($Value)) {
		throw "Missing required environment variable: $Name"
	}
	return $Value
}

function Parse-UriStrict($Value, $Name) {
	try {
		return [Uri]::new($Value)
	} catch {
		throw "$Name is not a valid URI: $Value"
	}
}

function Parse-PostgresUri($Value, $Name) {
	if ($Value -notmatch "^(postgres|postgresql)://") {
		throw "$Name must be a postgres/postgresql URL."
	}
	return Parse-UriStrict $Value $Name
}

function Redact-SecretText($Value) {
	if ($null -eq $Value) {
		return ""
	}
	$Text = [string]$Value
	$Text = $Text -replace "(postgres(?:ql)?://[^:/@\s]+:)[^@\s]+@", '$1***@'
	$Text = $Text -replace "(password=)[^;\s]+", '$1***'
	return $Text
}

function Is-LocalHostName($HostName) {
	$RawHostName = ""
	if ($null -ne $HostName) {
		$RawHostName = [string]$HostName
	}
	$Normalized = $RawHostName.Trim().ToLowerInvariant().Trim("[", "]")
	return @("localhost", "127.0.0.1", "::1", "0.0.0.0") -contains $Normalized
}

function Assert-LocalDbTarget($DbUrl, $Name) {
	$Uri = Parse-PostgresUri $DbUrl $Name
	if ($Uri.Host -match "(^|[.-])region([.-]|$)") {
		throw "$Name contains an unreplaced region placeholder in host '$($Uri.Host)'. Copy the exact connection string from Supabase Dashboard."
	}
	if (-not (Is-LocalHostName $Uri.Host)) {
		throw "$Name must point to localhost/127.0.0.1. Got host '$($Uri.Host)'. Refusing destructive restore."
	}
	if ($Uri.Port -ne 54322) {
		throw "$Name must point to Supabase local DB port 54322. Got port '$($Uri.Port)'. Refusing destructive restore."
	}
	return $Uri
}

function Assert-LocalHttpTarget($Url, $Name) {
	$Uri = Parse-UriStrict $Url $Name
	if (-not (Is-LocalHostName $Uri.Host)) {
		throw "$Name must point to localhost/127.0.0.1. Got host '$($Uri.Host)'. Refusing local storage writes."
	}
	if ($Uri.Port -ne 54321) {
		throw "$Name must point to Supabase local API port 54321. Got port '$($Uri.Port)'. Refusing local storage writes."
	}
	return $Uri
}

function Assert-NotLocalSource($Url, $Name) {
	$Uri = Parse-UriStrict $Url $Name
	if ($Uri.Host -match "(^|[.-])region([.-]|$)") {
		throw "$Name contains an unreplaced region placeholder in host '$($Uri.Host)'. Copy the exact endpoint from Supabase Dashboard."
	}
	if (Is-LocalHostName $Uri.Host) {
		throw "$Name looks local. This clone script expects production/remotes as source and local as target."
	}
	return $Uri
}

function Require-Command($CommandName) {
	$Command = Get-Command $CommandName -ErrorAction SilentlyContinue
	if (-not $Command) {
		if ($CommandName -eq "aws") {
			$AwsDefaultPath = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
			if (Test-Path -LiteralPath $AwsDefaultPath) {
				return $AwsDefaultPath
			}
		}
		throw "Required command not found in PATH: $CommandName"
	}
	return $Command.Source
}

function Invoke-CheckedNative($Exe, [string[]]$ArgsList) {
	Write-Host ""
	$SafeArgs = $ArgsList | ForEach-Object { Redact-SecretText $_ }
	Write-Host "Running: $Exe $($SafeArgs -join ' ')" -ForegroundColor DarkCyan
	& $Exe @ArgsList
	if ($LASTEXITCODE -ne 0) {
		throw "Command failed with exit code $LASTEXITCODE`: $Exe"
	}
}

function Invoke-OptionalNative($Exe, [string[]]$ArgsList) {
	Write-Host ""
	$SafeArgs = $ArgsList | ForEach-Object { Redact-SecretText $_ }
	Write-Host "Running optional: $Exe $($SafeArgs -join ' ')" -ForegroundColor DarkCyan
	& $Exe @ArgsList
	if ($LASTEXITCODE -ne 0) {
		Write-Host "Optional command failed with exit code $LASTEXITCODE; continuing." -ForegroundColor Yellow
	}
}

function New-AwsS3ConfigFile($Region, $Name) {
	$ConfigDir = Join-Path ([System.IO.Path]::GetTempPath()) "multi-tenant-prod-local-clone"
	New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
	$ConfigPath = Join-Path $ConfigDir "$Name.aws-config"
	$Content = @(
		"[default]",
		"region = $Region",
		"s3 =",
		"    addressing_style = path",
		"    signature_version = s3v4"
	)
	Set-Content -LiteralPath $ConfigPath -Value $Content -Encoding ASCII
	return $ConfigPath
}

function Use-AwsS3Credentials($AccessKeyName, $SecretKeyName, $Region, $ConfigPath) {
	$env:AWS_ACCESS_KEY_ID = Require-Env $AccessKeyName
	$env:AWS_SECRET_ACCESS_KEY = Require-Env $SecretKeyName
	$env:AWS_DEFAULT_REGION = $Region
	$env:AWS_REGION = $Region
	$env:AWS_CONFIG_FILE = $ConfigPath
	$env:AWS_EC2_METADATA_DISABLED = "true"
}

function Get-BucketsFromLocalDb($LocalDbUrl) {
	$Psql = Get-Command "psql" -ErrorAction SilentlyContinue
	if (-not $Psql) {
		return @()
	}
	$Output = & $Psql.Source $LocalDbUrl "-t" "-A" "-c" "select id from storage.buckets order by id;"
	if ($LASTEXITCODE -ne 0) {
		return @()
	}
	return @($Output | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Invoke-LocalSql($LocalDbUrl, $Sql) {
	$Psql = Require-Command "psql"
	Invoke-CheckedNative $Psql @(
		$LocalDbUrl,
		"-v", "ON_ERROR_STOP=1",
		"-c", $Sql
	)
}

function Local-RelationExists($LocalDbUrl, $RelationName) {
	$Psql = Require-Command "psql"
	$Sql = "select to_regclass('$RelationName') is not null;"
	$Output = & $Psql $LocalDbUrl "-t" "-A" "-c" $Sql
	if ($LASTEXITCODE -ne 0) {
		return $false
	}
	return (($Output | Select-Object -First 1).Trim().ToLowerInvariant() -eq "t")
}

function Get-TableColumns($DbUrl, $SchemaName, $TableName) {
	$Psql = Require-Command "psql"
	$Sql = "select column_name from information_schema.columns where table_schema = '$SchemaName' and table_name = '$TableName' order by ordinal_position;"
	$Output = & $Psql $DbUrl "-t" "-A" "-c" $Sql
	if ($LASTEXITCODE -ne 0) {
		throw "Failed to read columns for $SchemaName.$TableName"
	}
	return @($Output | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Quote-SqlLiteral($Value) {
	return "'" + ([string]$Value -replace "'", "''") + "'"
}

function Ensure-LocalStorageBucket($LocalDbUrl, $Bucket) {
	if (-not $LocalDbUrl) {
		throw "LOCAL_DB_URL is required to ensure local storage buckets."
	}
	if (-not (Local-RelationExists $LocalDbUrl "storage.buckets")) {
		throw "Local storage.buckets does not exist. Start Supabase local before cloning storage."
	}

	$Columns = Get-TableColumns $LocalDbUrl "storage" "buckets"
	$ColumnSet = @{}
	foreach ($Column in $Columns) {
		$ColumnSet[$Column] = $true
	}
	if (-not $ColumnSet.ContainsKey("id") -or -not $ColumnSet.ContainsKey("name")) {
		throw "Local storage.buckets must contain id and name columns."
	}

	$SqlColumns = @("id", "name")
	$SqlValues = @((Quote-SqlLiteral $Bucket), (Quote-SqlLiteral $Bucket))
	if ($ColumnSet.ContainsKey("public")) {
		$SqlColumns += "public"
		$SqlValues += "false"
	}

	$ColumnSql = ($SqlColumns | ForEach-Object { '"' + ($_ -replace '"', '""') + '"' }) -join ", "
	$ValueSql = $SqlValues -join ", "
	$Sql = "insert into storage.buckets ($ColumnSql) values ($ValueSql) on conflict (id) do update set name = excluded.name;"
	Invoke-LocalSql $LocalDbUrl $Sql
}

function Export-TableCsv($DbUrl, $SchemaName, $TableName, [string[]]$Columns, $Path) {
	$Psql = Require-Command "psql"
	$ColumnSql = ($Columns | ForEach-Object { '"' + ($_ -replace '"', '""') + '"' }) -join ", "
	$Sql = "\copy (select $ColumnSql from ""$SchemaName"".""$TableName"") to '$Path' with csv header"
	Invoke-CheckedNative $Psql @(
		$DbUrl,
		"-v", "ON_ERROR_STOP=1",
		"-c", $Sql
	)
}

function Import-TableCsv($DbUrl, $SchemaName, $TableName, [string[]]$Columns, $Path) {
	$Psql = Require-Command "psql"
	$ColumnSql = ($Columns | ForEach-Object { '"' + ($_ -replace '"', '""') + '"' }) -join ", "
	$Sql = "\copy ""$SchemaName"".""$TableName"" ($ColumnSql) from '$Path' with csv header"
	Invoke-CheckedNative $Psql @(
		$DbUrl,
		"-v", "ON_ERROR_STOP=1",
		"-c", $Sql
	)
}

function Normalize-LocalAuthUsers($LocalDbUrl) {
	$Columns = Get-TableColumns $LocalDbUrl "auth" "users"
	$ColumnSet = @{}
	foreach ($Column in $Columns) {
		$ColumnSet[$Column] = $true
	}
	$StringDefaultColumns = @(
		"confirmation_token",
		"recovery_token",
		"email_change_token_new",
		"email_change",
		"phone_change",
		"phone_change_token",
		"email_change_token_current",
		"reauthentication_token"
	)
	$Assignments = @()
	$Predicates = @()
	foreach ($Column in $StringDefaultColumns) {
		if ($ColumnSet.ContainsKey($Column)) {
			$QuotedColumn = '"' + ($Column -replace '"', '""') + '"'
			$Assignments += "$QuotedColumn = coalesce($QuotedColumn, '')"
			$Predicates += "$QuotedColumn is null"
		}
	}
	if ($Assignments.Count -eq 0) {
		return
	}
	$Sql = "update auth.users set $($Assignments -join ', ') where $($Predicates -join ' or ');"
	Invoke-LocalSql $LocalDbUrl $Sql
}

function Invoke-LocalMigrationFile($LocalDbUrl, $MigrationPath) {
	if (-not (Test-Path -LiteralPath $MigrationPath)) {
		throw "Required local migration not found: $MigrationPath"
	}
	$Psql = Require-Command "psql"
	Invoke-CheckedNative $Psql @(
		$LocalDbUrl,
		"-v", "ON_ERROR_STOP=1",
		"-f", $MigrationPath
	)
}

function Repair-LocalPostCloneSchema($LocalDbUrl) {
	$DataFlowMigrations = @(
		"supabase/migrations/0096_tenant_data_flow_config.sql",
		"supabase/migrations/0099_data_flow_dashboard_permissions.sql",
		"supabase/migrations/0100_data_flow_writeback_runs.sql"
	)
	foreach ($MigrationPath in $DataFlowMigrations) {
		Invoke-LocalMigrationFile $LocalDbUrl $MigrationPath
	}
}

function Sync-AuthUsers($ProdDbUrl, $LocalDbUrl, $CsvPath) {
	if (-not (Local-RelationExists $LocalDbUrl "auth.users")) {
		Write-Host "Local auth.users does not exist; skipping auth user restore." -ForegroundColor Yellow
		return
	}
	$ProdColumns = Get-TableColumns $ProdDbUrl "auth" "users"
	$LocalColumns = Get-TableColumns $LocalDbUrl "auth" "users"
	$LocalColumnSet = @{}
	foreach ($Column in $LocalColumns) {
		$LocalColumnSet[$Column] = $true
	}
	$Columns = @($ProdColumns | Where-Object { $LocalColumnSet.ContainsKey($_) })
	if ($Columns.Count -eq 0) {
		throw "No common columns found between prod and local auth.users."
	}
	Write-Host "Restoring auth.users using $($Columns.Count) common columns." -ForegroundColor Green
	Export-TableCsv $ProdDbUrl "auth" "users" $Columns $CsvPath
	Import-TableCsv $LocalDbUrl "auth" "users" $Columns $CsvPath
	Normalize-LocalAuthUsers $LocalDbUrl
}

function Split-BucketList($Value) {
	if ([string]::IsNullOrWhiteSpace($Value)) {
		return @()
	}
	return @(
		$Value.Split(",") |
			ForEach-Object { $_.Trim() } |
			Where-Object { $_ }
	)
}

function Confirm-Run($AssumeYesSwitch) {
	if ($AssumeYesSwitch) {
		return
	}
	Write-Host ""
	Write-Host "Type exactly CLONAR PROD A LOCAL to continue:" -ForegroundColor Yellow
	$Confirmation = Read-Host
	if ($Confirmation -ne "CLONAR PROD A LOCAL") {
		throw "Confirmation did not match. Aborting."
	}
}

Import-DotEnvFile $EnvFile
$Buckets = if ([string]::IsNullOrWhiteSpace($Buckets)) { $env:STORAGE_BUCKETS } else { $Buckets }

if ($env:ENABLE_PROD_TO_LOCAL_CLONE -ne "1") {
	throw "Set ENABLE_PROD_TO_LOCAL_CLONE=1 to enable this destructive local clone script."
}

$ProdDbUrl = if ($SkipDb) { $null } else { Require-Env "PROD_DB_URL" }
$LocalDbUrl = if ($SkipDb) { $env:LOCAL_DB_URL } else { Require-Env "LOCAL_DB_URL" }
if (-not $SkipStorage -and [string]::IsNullOrWhiteSpace($LocalDbUrl)) {
	$LocalDbUrl = Require-Env "LOCAL_DB_URL"
}
$LocalDbUri = if ($LocalDbUrl) { Assert-LocalDbTarget $LocalDbUrl "LOCAL_DB_URL" } else { $null }
$ProdDbUri = if ($ProdDbUrl) { Assert-NotLocalSource $ProdDbUrl "PROD_DB_URL" } else { $null }

$ProdStorageEndpoint = if ($SkipStorage) { $null } else { Require-Env "PROD_STORAGE_S3_ENDPOINT" }
$LocalStorageEndpoint = if ($SkipStorage) { $null } else { Require-Env "LOCAL_STORAGE_S3_ENDPOINT" }
$ProdStorageUri = if ($ProdStorageEndpoint) { Assert-NotLocalSource $ProdStorageEndpoint "PROD_STORAGE_S3_ENDPOINT" } else { $null }
$LocalStorageUri = if ($LocalStorageEndpoint) { Assert-LocalHttpTarget $LocalStorageEndpoint "LOCAL_STORAGE_S3_ENDPOINT" } else { $null }

if (-not $SkipStorage) {
	[void](Require-Env "PROD_STORAGE_ACCESS_KEY")
	[void](Require-Env "PROD_STORAGE_SECRET_KEY")
	[void](Require-Env "LOCAL_STORAGE_ACCESS_KEY")
	[void](Require-Env "LOCAL_STORAGE_SECRET_KEY")
	[void](Require-Env "PROD_STORAGE_REGION")
}

Write-Host ""
Write-Host "Prod to local clone plan" -ForegroundColor Cyan
$SourceDbLabel = if ($ProdDbUri) { $ProdDbUri.Host } else { "(skipped)" }
$TargetDbLabel = if ($LocalDbUri) { "$($LocalDbUri.Host):$($LocalDbUri.Port)" } else { "(skipped)" }
$SourceStorageLabel = if ($ProdStorageUri) { $ProdStorageUri.AbsoluteUri } else { "(skipped)" }
$TargetStorageLabel = if ($LocalStorageUri) { $LocalStorageUri.AbsoluteUri } else { "(skipped)" }
Write-Host "SOURCE DB:      $SourceDbLabel"
Write-Host "TARGET DB:      $TargetDbLabel"
Write-Host "SOURCE STORAGE: $SourceStorageLabel"
Write-Host "TARGET STORAGE: $TargetStorageLabel"
Write-Host ""
Write-Host "Safety checks passed: all destructive targets are local only." -ForegroundColor Green
if (-not $SkipDb -and -not $SkipLocalReset) {
	if ($UseSupabaseReset) {
		Write-Host "DB mode: supabase db reset --no-seed, then filtered data restore for auth.users/auth.identities and public." -ForegroundColor Green
	} else {
		Write-Host "DB mode: psql local public reset, then auth.users data and public schema+data restore." -ForegroundColor Green
	}
}

Confirm-Run $AssumeYes

if (-not $SkipDb) {
	$PgDump = Require-Command "pg_dump"
	$PgRestore = Require-Command "pg_restore"

	if (-not $SkipLocalReset) {
		if ($UseSupabaseReset) {
			$Npx = Require-Command "npx.cmd"
			Invoke-CheckedNative $Npx @(
				"supabase@latest",
				"db",
				"reset",
				"--no-seed"
			)
		} else {
			Invoke-LocalSql $LocalDbUrl "drop schema if exists public cascade;"
			if (Local-RelationExists $LocalDbUrl "auth.users") {
				Invoke-LocalSql $LocalDbUrl "truncate table auth.users cascade;"
			}
			if (Local-RelationExists $LocalDbUrl "storage.objects") {
				Invoke-LocalSql $LocalDbUrl "truncate table storage.objects cascade;"
			}
			if (Local-RelationExists $LocalDbUrl "storage.buckets") {
				Invoke-LocalSql $LocalDbUrl "truncate table storage.buckets cascade;"
			}
		}
	}

	Sync-AuthUsers $ProdDbUrl $LocalDbUrl $AuthDumpFile

	Invoke-CheckedNative $PgDump @(
		"--format=custom",
		"--no-owner",
		"--no-privileges",
		"--verbose",
		"--schema=public",
		"--dbname=$ProdDbUrl",
		"--file=$PublicDumpFile"
	)

	Invoke-CheckedNative $PgRestore @(
		"--exit-on-error",
		"--no-owner",
		"--no-privileges",
		"--verbose",
		"--dbname=$LocalDbUrl",
		$PublicDumpFile
	)

	Invoke-LocalSql $LocalDbUrl "grant usage on schema public to postgres, anon, authenticated, service_role; grant all on schema public to postgres, service_role; grant usage on schema public to anon, authenticated; grant all privileges on all tables in schema public to postgres, service_role; grant select, insert, update, delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant all privileges on all sequences in schema public to postgres, service_role; grant usage, select on all sequences in schema public to authenticated, anon; alter default privileges in schema public grant all privileges on tables to postgres, service_role; alter default privileges in schema public grant select, insert, update, delete on tables to authenticated; alter default privileges in schema public grant select on tables to anon; alter default privileges in schema public grant all privileges on sequences to postgres, service_role; alter default privileges in schema public grant usage, select on sequences to authenticated, anon;"
	Repair-LocalPostCloneSchema $LocalDbUrl
	Invoke-LocalSql $LocalDbUrl "grant usage on schema public to postgres, anon, authenticated, service_role; grant all on schema public to postgres, service_role; grant usage on schema public to anon, authenticated; grant all privileges on all tables in schema public to postgres, service_role; grant select, insert, update, delete on all tables in schema public to authenticated; grant select on all tables in schema public to anon; grant all privileges on all sequences in schema public to postgres, service_role; grant usage, select on all sequences in schema public to authenticated, anon; alter default privileges in schema public grant all privileges on tables to postgres, service_role; alter default privileges in schema public grant select, insert, update, delete on tables to authenticated; alter default privileges in schema public grant select on tables to anon; alter default privileges in schema public grant all privileges on sequences to postgres, service_role; alter default privileges in schema public grant usage, select on sequences to authenticated, anon;"
}

if (-not $SkipStorage) {
	$Aws = Require-Command "aws"
	$ProdStorageRegion = Require-Env "PROD_STORAGE_REGION"
	$LocalStorageRegion = if ([string]::IsNullOrWhiteSpace($env:LOCAL_STORAGE_REGION)) { "local" } else { $env:LOCAL_STORAGE_REGION }
	$ProdAwsConfig = New-AwsS3ConfigFile $ProdStorageRegion "prod"
	$LocalAwsConfig = New-AwsS3ConfigFile $LocalStorageRegion "local"
	$BucketList = Split-BucketList $Buckets
	if ($BucketList.Count -eq 0 -and $LocalDbUrl) {
		$BucketList = Get-BucketsFromLocalDb $LocalDbUrl
	}
	if ($BucketList.Count -eq 0) {
		throw "No buckets to clone. Set STORAGE_BUCKETS=obra-documents,other-bucket or install psql so the script can read storage.buckets from local DB."
	}

	New-Item -ItemType Directory -Force -Path $StorageTempDir | Out-Null

	foreach ($Bucket in $BucketList) {
		$BucketTempDir = Join-Path $StorageTempDir $Bucket
		New-Item -ItemType Directory -Force -Path $BucketTempDir | Out-Null

		Use-AwsS3Credentials "PROD_STORAGE_ACCESS_KEY" "PROD_STORAGE_SECRET_KEY" $ProdStorageRegion $ProdAwsConfig
		Invoke-CheckedNative $Aws @(
			"--endpoint-url", $ProdStorageEndpoint,
			"--region", $ProdStorageRegion,
			"s3", "sync",
			"s3://$Bucket",
			$BucketTempDir,
			"--only-show-errors"
		)

		Use-AwsS3Credentials "LOCAL_STORAGE_ACCESS_KEY" "LOCAL_STORAGE_SECRET_KEY" $LocalStorageRegion $LocalAwsConfig
		Invoke-OptionalNative $Aws @(
			"--endpoint-url", $LocalStorageEndpoint,
			"--region", $LocalStorageRegion,
			"s3", "mb",
			"s3://$Bucket"
		)
		Ensure-LocalStorageBucket $LocalDbUrl $Bucket
		Invoke-CheckedNative $Aws @(
			"--endpoint-url", $LocalStorageEndpoint,
			"--region", $LocalStorageRegion,
			"s3", "sync",
			$BucketTempDir,
			"s3://$Bucket",
			"--only-show-errors"
		)
	}
}

Write-Host ""
Write-Host "Clone completed. Production was used only as read source." -ForegroundColor Green
