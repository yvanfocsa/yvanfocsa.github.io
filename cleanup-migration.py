#!/usr/bin/env python3
"""
Script de nettoyage post-migration
Supprime les fichiers temporaires et l'ancien code une fois la migration validée
"""

import os
from pathlib import Path

def main():
    """Fonction principale de nettoyage"""
    print("🧹 Nettoyage Post-Migration OUDAR Avocats")
    print("=" * 50)
    
    # Fichiers à supprimer
    files_to_clean = [
        'script.js',              # Ancien code JavaScript
        'index-new.html',         # Fichier de test
        'update-html-files.py',   # Script de migration
        'validate-migration.py',  # Script de validation
        'start-server.py',        # Serveur de dev (optionnel)
        'cleanup-migration.py'    # Ce script lui-même
    ]
    
    # Demande confirmation
    print("⚠️  ATTENTION: Cette opération va supprimer :")
    for file_path in files_to_clean:
        if Path(file_path).exists():
            print(f"   🗑️  {file_path}")
    
    print()
    print("💾 SERA CONSERVÉ :")
    print("   ✅ script.js.backup (sauvegarde de sécurité)")
    print("   ✅ js/ (nouvelle architecture)")
    print("   ✅ package.json")
    print("   ✅ TEST-CHECKLIST.md")
    
    print()
    response = input("Êtes-vous sûr de vouloir nettoyer ? (oui/non): ").lower().strip()
    
    if response not in ['oui', 'o', 'yes', 'y']:
        print("❌ Nettoyage annulé")
        return
    
    # Effectue le nettoyage
    deleted_count = 0
    
    for file_path in files_to_clean:
        path = Path(file_path)
        
        if path.exists():
            try:
                path.unlink()
                print(f"🗑️  Supprimé: {file_path}")
                deleted_count += 1
            except Exception as e:
                print(f"❌ Erreur suppression {file_path}: {e}")
        else:
            print(f"ℹ️  Déjà absent: {file_path}")
    
    print("=" * 50)
    print(f"📊 Nettoyage terminé: {deleted_count} fichiers supprimés")
    
    if deleted_count > 0:
        print()
        print("🎉 Projet nettoyé avec succès !")
        print("📁 Structure finale optimale atteinte")
        print("🚀 Développement avec la nouvelle architecture prêt !")
    
    print()
    print("💡 Pour information, la structure finale est :")
    print("   📁 js/ (nouvelle architecture modulaire)")
    print("   📄 *.html (mis à jour)")
    print("   📄 style.css (inchangé)")
    print("   📁 assets/ (inchangé)")
    print("   📄 script.js.backup (sauvegarde)")

if __name__ == "__main__":
    main()