import groovy.json.JsonOutput
import groovy.json.JsonSlurper

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.couchtv.launcher"
    compileSdk = 34
    defaultConfig {
        applicationId = "app.couchtv.launcher"
        minSdk = 23          // Android 6.0 (older Mi TVs); Fire OS 6 (7.1) sticks install it too
        targetSdk = 34
        versionCode = 14
        versionName = "0.12"
        // Where the bridge might be: ./gradlew assembleRelease -PbridgeUrls=http://my-computer.local:5400
        // (comma separated, more than one is fine). The last one that answered is remembered on the TV.
        // Without it, apply.sh tells the app the address when it installs (the "bridge" extra), and
        // with no address at all (option A) the copy of the home built into the app is the home.
        val urls = (project.findProperty("bridgeUrls") as String? ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }
        buildConfigField("String[]", "BRIDGES", "{" + urls.joinToString(", ") { "\"" + it + "\"" } + "}")
        // Whose GitHub releases Home settings, Updates offers: -PupdateRepo=owner/name for a fork
        // with releases of its own, -PupdateRepo= (empty) for none. Updater.kt checks the format.
        val updateRepo = (project.findProperty("updateRepo") as String? ?: "").trim()
        buildConfigField("String", "UPDATE_REPO", "\"" + updateRepo.filter { it.isLetterOrDigit() || it in "/._-" } + "\"")
    }
    buildFeatures { buildConfig = true }
    // Test builds: when COUCHTV_KEYSTORE names a keystore (a debug-style key, alias androiddebugkey,
    // password android), release builds are signed with it, so one test build can update the last (#4).
    val fixedKey = System.getenv("COUCHTV_KEYSTORE")?.let { file(it) }?.takeIf { it.isFile }
    signingConfigs {
        if (fixedKey != null) create("fixed") {
            storeFile = fixedKey
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("fixed") ?: signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

/**
 * Copies tv-home/web into the app as assets/www/tv, plus a config.js made from config.json, so the
 * home works with no computer at all (option A). The settings file is -PconfigJson=<path>, else
 * config.json in the repo root, else config.example.json. apply.sh can hand the TV newer settings
 * later without a rebuild. Only the parts the TV home shows are copied: weather, the
 * home's look and each TV's quick buttons. Never secrets.
 */
abstract class BundleTvWeb : DefaultTask() {
    @get:InputDirectory
    abstract val web: DirectoryProperty

    @get:InputFile
    abstract val configJson: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun run() {
        val out = outputDir.get().asFile
        out.deleteRecursively()
        val dest = File(out, "www/tv")
        val src = web.get().asFile
        src.walkTopDown().filter { it.isFile }.forEach { f ->
            val rel = f.relativeTo(src).path
            // development only, or not part of the page
            if (rel.endsWith(".md") || f.name.startsWith(".")) return@forEach
            f.copyTo(File(dest, rel), overwrite = true)
        }
        File(dest, "config.js").writeText("window.COUCH_CONFIG = " + JsonOutput.toJson(publicConfig(configJson.get().asFile)) + ";\n")
    }

    private fun slug(s: Any?, fallback: String): String =
        Regex("[^a-z0-9]+").replace(s.toString().lowercase(), "-").trim('-').take(32).ifEmpty { fallback }

    @Suppress("UNCHECKED_CAST")
    private fun publicConfig(file: File): Map<String, Any?> {
        val c = JsonSlurper().parse(file) as Map<String, Any?>
        // The key (tmdb.api_key) is the user's own, from their git-ignored config.json, and only ends up in their own APK.
        return linkedMapOf(
            "weather" to c["weather"],
            "home" to (c["home"] ?: emptyMap<String, Any?>()),
            "tmdb" to (c["tmdb"] ?: emptyMap<String, Any?>()),
            "demo" to (c["demo"] == true),
        )
    }
}

dependencies {
    // Unit tests for the plain Kotlin rules (FireWatchTest), run with testDebugUnitTest (EPL 1.0).
    testImplementation("junit:junit:4.13.2")
}

val repoRoot = rootProject.projectDir.resolve("../..")
val configFile: File = (project.findProperty("configJson") as String?)?.let { file(it) }
    ?: repoRoot.resolve("config.json").takeIf { it.isFile }
    ?: repoRoot.resolve("config.example.json")

val bundleTvWeb = tasks.register<BundleTvWeb>("bundleTvWeb") {
    web.set(rootProject.layout.projectDirectory.dir("../web"))
    configJson.set(configFile)
    outputDir.set(layout.buildDirectory.dir("generated/tvweb"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(bundleTvWeb, BundleTvWeb::outputDir)
    }
}
