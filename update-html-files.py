#!/usr/bin/env python3
"""
Script pour mettre à jour tous les fichiers HTML avec la nouvelle architecture
Remplace les imports de script.js par la nouvelle architecture modulaire
"""

import os
import re
from pathlib import Path

def update_html_file(file_path):
    """Met à jour un fichier HTML individuel"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern pour trouver l'ancien script
        old_script_pattern = r'<script\s+src="script\.js"[^>]*></script>'
        
        # Nouveau script modulaire
        new_script = '''    <!-- === NOUVELLE ARCHITECTURE MODULAIRE === -->
    <!-- Module principal ES6 -->
    <script type="module" src="js/main.js"></script>
    
    <!-- Fallback pour navigateurs anciens -->
    <script nomodule>
      console.warn('⚠️ Ce navigateur ne supporte pas les modules ES6.');
      console.info('ℹ️ Certaines fonctionnalités avancées peuvent être limitées.');
    </script>'''
        
        # Remplace l'ancien script
        updated_content = re.sub(old_script_pattern, new_script, content)
        
        # Vérifie si un changement a été fait
        if updated_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"✅ Mis à jour: {file_path}")
            return True
        else:
            print(f"ℹ️  Aucun changement: {file_path}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur sur {file_path}: {e}")
        return False

def main():
    """Fonction principale"""
    print("🔄 Mise à jour des fichiers HTML vers la nouvelle architecture")
    print("=" * 60)
    
    # Liste de tous les fichiers HTML à mettre à jour
    html_files = [
        'index.html',
        'cabinet.html', 
        'expertises.html',
        'honoraires.html',
        'contact.html',
        'blog.html',
        'consultation.html',
        'expertise-droit-immobilier.html',
        'expertise-droit-de-la-construction.html',
        'expertise-droit-de-la-copropriete.html',
        'expertise-contentieux-civil-commercial.html',
        'expertise-vente-forcee.html',
        'expertise-droit-famille.html',
        'team-svetlana.html',
        'team-sharon.html',
        'team-leonie.html',
        'mentions-legales.html',
        'plan-du-site.html',
        'gestion-cookies.html'
    ]
    
    updated_count = 0
    error_count = 0
    
    for html_file in html_files:
        file_path = Path(html_file)
        
        if file_path.exists():
            if update_html_file(file_path):
                updated_count += 1
        else:
            print(f"⚠️  Fichier non trouvé: {html_file}")
            error_count += 1
    
    print("=" * 60)
    print(f"📊 Résumé:")
    print(f"   ✅ Fichiers mis à jour: {updated_count}")
    print(f"   ❌ Erreurs: {error_count}")
    print(f"   📁 Total traité: {len(html_files)}")
    
    if updated_count > 0:
        print()
        print("🎉 Migration terminée avec succès !")
        print("🧪 Testez maintenant avec: python3 start-server.py")
        print("🌐 Puis ouvrez: http://localhost:8000")
    else:
        print()
        print("ℹ️  Aucune mise à jour nécessaire.")

if __name__ == "__main__":
    main()