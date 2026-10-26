"""從 Freesound CC0 原始錄音剪出 App 用的短音效（mp3、單聲道、44.1kHz）。

用法：python3 make_sfx.py <原始 wav 資料夾> [輸出資料夾，預設為本資料夾]
原始檔不放進 repo（約 75MB），檔名維持 Freesound 下載時的「<編號>__<作者>__<標題>.wav」。
每一段 = (輸出檔名, 來源編號, 起點秒, 終點秒, 高通 Hz, 淡出秒, 目標響度 dB＝最大 100ms RMS)
"""
import sys, os, glob, subprocess, tempfile
import numpy as np, soundfile as sf, scipy.signal as sg

SR = 44100
SRC = {  # Freesound 編號 → 用途（全部為 CC0）
    564128: 'snuq：Playing cards on a wooden table',
    734631: 'Vrymaa：Playing cards - Shuffling deck & deal',
    217503: 'VKProduktion：Shuffling cards (riffle) 03',
    194686: 'kingsrow：PieceofWood01',
    181262: 'CapsLok：Pencils Shake Throw',
    91196: 'surly：Buddhist Prayer Bell',
    59159: 'Coleco：singingbowlstruck2',
    607218: 'jonopodmore：Fujimoto（小金屬鈴）',
    607215: 'jonopodmore：Mokugyo（木魚）',
    716245: 'Squirrel_404：Light Taps',
    753282: 'Vrymaa：Parchment - Unroll',
}
CUTS = [
    # 塔羅：翻牌＝拇指撥起的輕響＋牌面拍桌
    ('flip0', 564128, 2.035, 2.40, 150, .12, -21),
    ('flip1', 564128, 7.640, 7.92, 150, .12, -21),
    ('flip2', 564128, 14.245, 14.56, 150, .12, -21),
    ('flip3', 564128, 8.995, 9.26, 150, .12, -21),
    # 發牌：牌滑出牌堆、落在桌上
    ('deal0', 734631, 16.70, 17.08, 120, .08, -21),
    ('deal1', 734631, 19.74, 20.12, 120, .08, -21),
    ('deal2', 734631, 21.37, 21.70, 120, .08, -21),
    # 洗牌（每日一抽用短版；牌陣用長版，見 compose()）
    ('shuffle_short', 217503, 1.85, 2.80, 120, .15, -22),
    # 擲筊：筊杯落地的主擊、搖晃回彈
    ('clack0', 194686, 0.315, 0.80, 60, .15, -14),
    ('clack1', 194686, 1.225, 1.50, 60, .10, -14),
    ('rock0', 194686, 0.885, 1.20, 60, .10, -16),
    ('rock1', 194686, 1.555, 1.75, 60, .08, -16),
    # 求籤：搖籤筒、一支籤落地
    ('shake', 181262, 7.45, 8.62, 80, .12, -17),
    ('stick', 181262, 12.32, 12.85, 80, .15, -17),
    # 磬（聖筊）、頌缽（神明賜籤）、小鈴（大阿爾克那）
    ('bell', 91196, 4.20, 14.0, 80, 3.0, -11),
    ('bowl', 59159, 0.0, 12.0, 60, 4.0, -12),
    ('ting', 607218, 10.00, 10.80, 300, .55, -17),
    # 木魚、按鍵輕敲、展開籤詩
    ('moku', 607215, 0.0, 0.60, 60, .25, -16),
    ('tap0', 716245, 1.785, 1.86, 200, .03, -22),
    ('tap1', 716245, 2.665, 2.73, 200, .03, -22),
    ('tap2', 716245, 8.918, 8.99, 200, .03, -22),
    ('unroll', 753282, 15.55, 16.32, 150, .2, -19),
]


def load(src, fid):
    p = glob.glob(os.path.join(src, f'{fid}__*.wav'))
    assert p, f'找不到 Freesound #{fid} 的原始檔'
    x, sr = sf.read(p[0], always_2d=True)
    x = x.mean(1)
    if sr != SR:
        x = sg.resample_poly(x, SR, sr)
    return x


def cut(x, a, b, hp, fo):
    s = x[int(a * SR):int(b * SR)].copy()
    s = sg.sosfiltfilt(sg.butter(2, hp / (SR / 2), 'high', output='sos'), s)
    fi = int(.003 * SR)
    s[:fi] *= np.linspace(0, 1, fi)
    n = int(fo * SR)
    s[-n:] *= np.linspace(1, 0, n) ** 2
    return s


def loud(s):
    n = int(.1 * SR)
    return max(np.sqrt(np.mean(s[i:i + n] ** 2)) for i in range(0, max(1, len(s) - n), n // 4))


def norm(s, db):
    """依感受音量（最大 100ms RMS）對齊，超過 0.7 的瞬間尖峰柔性壓縮到 0.95 以內。"""
    s = s / loud(s) * 10 ** (db / 20)
    a = np.abs(s)
    k = a > .7
    s[k] = np.sign(s[k]) * (.7 + .25 * np.tanh((a[k] - .7) / .25))
    return s


def compose(raw):
    """牌陣洗牌（約 2.2 秒，配合收攏→混牌→切牌動畫）：鴿尾洗牌＋最後整牌在桌上敲兩下。"""
    rif = norm(cut(raw[217503], 0.10, 1.80, 120, .18), -22)
    k1 = norm(cut(raw[564128], 45.305, 45.45, 150, .06), -20)
    k2 = norm(cut(raw[564128], 46.545, 46.69, 150, .06), -23)
    out = np.zeros(int(2.2 * SR))
    for sig, t in ((rif, 0), (k1, 1.82), (k2, 1.97)):
        i = int(t * SR)
        out[i:i + len(sig)] += sig[:len(out) - i]
    return out


def mp3(s, path):
    with tempfile.NamedTemporaryFile(suffix='.wav') as t:
        sf.write(t.name, s, SR, subtype='PCM_16')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', t.name, '-ac', '1', '-ar', str(SR),
                        '-c:a', 'libmp3lame', '-q:a', '4', path], check=True)


if __name__ == '__main__':
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
    raw = {fid: load(src, fid) for fid in SRC}
    for name, fid, a, b, hp, fo, db in CUTS:
        mp3(norm(cut(raw[fid], a, b, hp, fo), db), os.path.join(out, name + '.mp3'))
    mp3(compose(raw), os.path.join(out, 'shuffle.mp3'))
    print('done', len(CUTS) + 1, 'files')
