#!/usr/bin/env python3
"""
Serveur de développement simple pour OUDAR Avocats
Lance un serveur HTTP local pour tester la nouvelle architecture
"""

import http.server
import socketserver
import webbrowser
import sys
import os
from pathlib import Path

def start_server():
    """Lance le serveur de développement"""
    
    # Configuration
    PORT = 8000
    HOST = 'localhost'
    
    # Change vers le répertoire du projet
    project_root = Path(__file__).parent
    os.chdir(project_root)
    
    print("🏛️  OUDAR Avocats - Serveur de Développement")
    print("=" * 50)
    print(f"📁 Répertoire: {project_root}")
    print(f"🌐 URL: http://{HOST}:{PORT}")
    print(f"🧪 URL de test: http://{HOST}:{PORT}/index-new.html")
    print("=" * 50)
    print("💡 Appuyez sur Ctrl+C pour arrêter le serveur")
    print()
    
    try:
        # Configure le serveur
        handler = http.server.SimpleHTTPRequestHandler
        handler.extensions_map.update({
            '.js': 'application/javascript',
            '.mjs': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.json': 'application/json'
        })
        
        with socketserver.TCPServer((HOST, PORT), handler) as httpd:
            print(f"✅ Serveur démarré sur http://{HOST}:{PORT}")
            
            # Ouvre le navigateur automatiquement
            try:
                webbrowser.open(f'http://{HOST}:{PORT}/index-new.html')
                print("🌐 Navigateur ouvert automatiquement")
            except:
                print("ℹ️  Ouvrez manuellement: http://localhost:8000/index-new.html")
            
            print()
            print("🔧 Pages disponibles:")
            print("   • http://localhost:8000/index-new.html (NOUVELLE ARCHITECTURE)")
            print("   • http://localhost:8000/index.html (ancienne version)")
            print("   • http://localhost:8000/?test=true (avec tests unitaires)")
            print()
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Serveur arrêté par l'utilisateur")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ Le port {PORT} est déjà utilisé")
            print(f"💡 Essayez: python3 start-server.py --port 8001")
        else:
            print(f"❌ Erreur serveur: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Support pour port personnalisé
    if "--port" in sys.argv:
        try:
            port_index = sys.argv.index("--port") + 1
            PORT = int(sys.argv[port_index])
        except (IndexError, ValueError):
            print("❌ Port invalide. Usage: python3 start-server.py --port 8001")
            sys.exit(1)
    
    start_server()