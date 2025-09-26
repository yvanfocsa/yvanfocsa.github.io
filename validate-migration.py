#!/usr/bin/env python3
"""
Script de validation de la migration
Vérifie que tous les fichiers sont en place et la structure est correcte
"""

import os
import json
from pathlib import Path

def check_file_exists(file_path, description=""):
    """Vérifie qu'un fichier existe"""
    path = Path(file_path)
    exists = path.exists()
    status = "✅" if exists else "❌"
    print(f"  {status} {file_path} {description}")
    return exists

def check_directory_structure():
    """Vérifie la structure des dossiers"""
    print("📁 Vérification de la structure des dossiers:")
    
    required_dirs = [
        "js",
        "js/config", 
        "js/modules",
        "js/modules/ui",
        "js/modules/features", 
        "js/modules/pages",
        "js/utils",
        "js/tests",
        "js/docs"
    ]
    
    all_exist = True
    for dir_path in required_dirs:
        exists = Path(dir_path).exists()
        status = "✅" if exists else "❌"
        print(f"  {status} {dir_path}/")
        if not exists:
            all_exist = False
    
    return all_exist

def check_js_files():
    """Vérifie tous les fichiers JavaScript"""
    print("\n🔧 Vérification des fichiers JavaScript:")
    
    js_files = [
        # Config
        ("js/config/settings.js", "Configuration globale"),
        ("js/config/translations.js", "Traductions multilingues"),
        
        # Utils
        ("js/utils/logger.js", "Système de logging"),
        ("js/utils/dom.js", "Utilitaires DOM"),
        ("js/utils/performance.js", "Optimisations performance"),
        ("js/utils/stateManager.js", "Gestionnaire d'état"),
        ("js/utils/storage.js", "Gestion localStorage"),
        ("js/utils/lazyLoader.js", "Chargement différé"),
        ("js/utils/events.js", "Système d'événements"),
        ("js/utils/errorHandler.js", "Gestion d'erreurs"),
        
        # Modules UI
        ("js/modules/ui/darkMode.js", "Mode sombre"),
        ("js/modules/ui/loader.js", "Écran de chargement"),
        ("js/modules/ui/carousel.js", "Carrousels"),
        ("js/modules/ui/drawer.js", "Menu mobile"),
        ("js/modules/ui/header.js", "Header"),
        ("js/modules/ui/animations.js", "Animations"),
        
        # Modules Features
        ("js/modules/features/language.js", "Multilingue"),
        ("js/modules/features/cookies.js", "Gestion cookies"),
        ("js/modules/features/forms.js", "Formulaires"),
        ("js/modules/features/navigation.js", "Navigation"),
        ("js/modules/features/expertiseNav.js", "Navigation expertise"),
        ("js/modules/features/blog.js", "Blog"),
        
        # Modules Pages
        ("js/modules/pages/home.js", "Page d'accueil"),
        ("js/modules/pages/contact.js", "Page contact"),
        ("js/modules/pages/expertises.js", "Page expertises"),
        ("js/modules/pages/team.js", "Pages équipe"),
        
        # Point d'entrée
        ("js/main.js", "Application principale"),
        
        # Tests et docs
        ("js/tests/utils.test.js", "Tests unitaires"),
        ("js/docs/README.md", "Documentation"),
        ("js/docs/MIGRATION.md", "Guide migration"),
        ("js/docs/ARCHITECTURE.md", "Architecture")
    ]
    
    all_exist = True
    for file_path, description in js_files:
        if not check_file_exists(file_path, f"- {description}"):
            all_exist = False
    
    return all_exist

def check_html_updates():
    """Vérifie que les fichiers HTML ont été mis à jour"""
    print("\n📄 Vérification des mises à jour HTML:")
    
    html_files = [
        'index.html',
        'cabinet.html',
        'expertises.html', 
        'honoraires.html',
        'contact.html',
        'blog.html',
        'consultation.html'
    ]
    
    updated_count = 0
    total_count = 0
    
    for html_file in html_files:
        path = Path(html_file)
        total_count += 1
        
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Vérifie si le nouveau script est présent
            if 'js/main.js' in content and 'type="module"' in content:
                print(f"  ✅ {html_file} - Mis à jour")
                updated_count += 1
            elif 'script.js' in content:
                print(f"  ⚠️  {html_file} - Ancien script détecté")
            else:
                print(f"  ❓ {html_file} - État inconnu")
        else:
            print(f"  ❌ {html_file} - Fichier manquant")
    
    print(f"\n📊 Résultat: {updated_count}/{total_count} fichiers mis à jour")
    return updated_count == total_count

def check_backup():
    """Vérifie que la sauvegarde existe"""
    print("\n💾 Vérification de la sauvegarde:")
    return check_file_exists("script.js.backup", "- Sauvegarde de l'ancien code")

def check_package_json():
    """Vérifie le package.json"""
    print("\n📦 Vérification de la configuration:")
    
    if check_file_exists("package.json", "- Configuration npm"):
        try:
            with open("package.json", 'r') as f:
                pkg = json.load(f)
            
            print(f"  ℹ️  Nom: {pkg.get('name', 'N/A')}")
            print(f"  ℹ️  Version: {pkg.get('version', 'N/A')}")
            print(f"  ℹ️  Type: {pkg.get('type', 'N/A')}")
            return True
        except Exception as e:
            print(f"  ❌ Erreur lecture package.json: {e}")
            return False
    
    return False

def generate_validation_report():
    """Génère un rapport de validation"""
    print("\n" + "="*60)
    print("📋 RAPPORT DE VALIDATION DE MIGRATION")
    print("="*60)
    
    checks = [
        ("Structure des dossiers", check_directory_structure()),
        ("Fichiers JavaScript", check_js_files()),
        ("Mises à jour HTML", check_html_updates()),
        ("Sauvegarde", check_backup()),
        ("Configuration", check_package_json())
    ]
    
    passed = sum(1 for _, result in checks if result)
    total = len(checks)
    
    print(f"\n📊 RÉSUMÉ FINAL:")
    print(f"   ✅ Tests réussis: {passed}/{total}")
    print(f"   📈 Pourcentage: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print(f"\n🎉 MIGRATION RÉUSSIE !")
        print(f"🚀 Vous pouvez maintenant tester avec:")
        print(f"   python3 start-server.py")
        print(f"   Puis ouvrir: http://localhost:8000")
    else:
        print(f"\n⚠️  MIGRATION INCOMPLÈTE")
        print(f"🔧 Vérifiez les éléments marqués ❌ ci-dessus")
    
    return passed == total

if __name__ == "__main__":
    success = generate_validation_report()
    exit(0 if success else 1)