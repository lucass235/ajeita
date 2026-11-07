"""Le as fotos e o audio de um post de fotos (slideshow) do TikTok.

O yt-dlp nao reconhece URLs /photo/ ("Unsupported URL") e, num slideshow, so entrega
o audio. Este script reaproveita a busca de pagina do proprio yt-dlp (impersonate +
desafio JS do TikTok) para ler os dados do post e grava um JSON com as URLs das fotos.

Uso: python tiktok_slideshow.py URL SAIDA.json [COOKIES.txt]
Codigos de saida: 0 ok | 1 erro de extracao | 2 URL invalida | 3 o post nao tem fotos
"""
import json
import re
import sys

POST_URL = re.compile(r'^https?://(?:www\.)?tiktok\.com/@[\w.-]*/(?:photo|video)/(\d+)', re.I)


def fail(code, message):
    print('ERROR: ' + message, file=sys.stderr)
    sys.exit(code)


def main(argv):
    if len(argv) < 3:
        fail(2, 'uso: tiktok_slideshow.py URL SAIDA.json [COOKIES.txt]')
    url, output = argv[1], argv[2]
    cookies = argv[3] if len(argv) > 3 else None
    match = POST_URL.match(url)
    if not match:
        fail(2, 'URL de post do TikTok invalida: ' + url)
    video_id = match.group(1)
    # O extrator do yt-dlp so conhece /video/; o mesmo ID abre o post de fotos.
    web_url = re.sub(r'/photo/', '/video/', url, count=1, flags=re.I)

    import yt_dlp

    params = {'quiet': True, 'no_warnings': True, 'socket_timeout': 20}
    if cookies:
        params['cookiefile'] = cookies
    try:
        from yt_dlp.networking.impersonate import ImpersonateTarget
        params['impersonate'] = ImpersonateTarget.from_str('chrome')
    except ImportError:
        pass  # yt-dlp antigo: segue sem impersonate

    try:
        with yt_dlp.YoutubeDL(params) as ydl:
            extractor = ydl.get_info_extractor('TikTok')
            extractor.set_downloader(ydl)
            data, _status = extractor._extract_web_data_and_status(web_url, video_id, fatal=True)
    except AttributeError as error:
        fail(1, 'esta versao do yt-dlp nao expoe os dados do post (' + str(error) + ')')
    except Exception as error:  # ExtractorError, rede, login exigido...
        fail(1, str(error))

    data = data or {}
    images = []
    for image in (data.get('imagePost') or {}).get('images') or []:
        urls = [u for u in ((image.get('imageURL') or {}).get('urlList') or []) if isinstance(u, str)]
        if urls:
            images.append({'urls': urls, 'width': image.get('imageWidth'), 'height': image.get('imageHeight')})
    if not images:
        fail(3, 'o post nao tem fotos')

    music = data.get('music') or {}
    audio_url = music.get('playUrl') if isinstance(music.get('playUrl'), str) else None
    result = {
        'id': video_id,
        'description': data.get('desc') or '',
        'images': images,
        'audio': {'url': audio_url, 'duration': music.get('duration'), 'title': music.get('title')} if audio_url else None,
    }
    with open(output, 'w', encoding='utf-8') as handle:
        json.dump(result, handle, ensure_ascii=False)


if __name__ == '__main__':
    main(sys.argv)
