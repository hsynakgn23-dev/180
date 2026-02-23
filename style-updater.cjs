const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'apps/mobile/src/ui/appStyles.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// Container padding
content = content.replace(
    /paddingHorizontal: 18,\s*paddingTop: 24,\s*paddingBottom: 32,\s*gap: 16,/g,
    'paddingHorizontal: 22,\n    paddingTop: 32,\n    paddingBottom: 40,\n    gap: 20,'
);

// Typography Updates
content = content.replace(
    /fontSize: 29,\s*fontFamily: 'Inter_700Bold',\s*fontWeight: '700',\s*lineHeight: 34,/g,
    "fontSize: 34,\n    fontFamily: 'Inter_700Bold',\n    fontWeight: '700',\n    lineHeight: 38,\n    letterSpacing: -0.5,"
);
content = content.replace(
    /fontSize: 14,\s*fontFamily: 'Inter_500Medium',\s*lineHeight: 20,\s*marginBottom: 8,/g,
    "fontSize: 15,\n    fontFamily: 'Inter_500Medium',\n    lineHeight: 22,\n    marginBottom: 8,"
);
content = content.replace(
    /fontSize: 19,\s*fontFamily: 'Inter_700Bold',\s*fontWeight: '700',/g,
    "fontSize: 22,\n    fontFamily: 'Inter_700Bold',\n    fontWeight: '700',\n    letterSpacing: -0.3,"
);

// Bottom tab pills
content = content.replace(
    /bottomTabBar: {\s*(.*?)\s*left: 12,\s*right: 12,\s*bottom: 10,\s*(.*?)\s*borderRadius: 16,\s*(.*?)\s*},/gs,
    (match, p1, p2, p3) => `bottomTabBar: {\n    ${p1}\n    left: 16,\n    right: 16,\n    bottom: 24,\n    ${p2}\n    borderRadius: 999,\n    ${p3}\n  },`
);
content = content.replace(
    /navTabBar: {\s*(.*?)\s*left: 16,\s*right: 16,\s*bottom: 16,\s*(.*?)\s*borderRadius: 32,\s*height: 74,\s*paddingBottom: 10,\s*paddingTop: 8,\s*(.*?)\s*},/gs,
    (match, p1, p2, p3) => `navTabBar: {\n    ${p1}\n    left: 20,\n    right: 20,\n    bottom: 28,\n    ${p2}\n    borderRadius: 999,\n    height: 78,\n    paddingBottom: 0,\n    paddingTop: 0,\n    ${p3}\n  },`
);

content = content.replace(/navTabLabel: {/g, 'navTabLabel: {\n    marginTop: 2,');
content = content.replace(/navTabItem: {\s*paddingTop: 4,\s*}/g, 'navTabItem: {\n    paddingTop: 8,\n  }');

const replacements = [
    [/borderRadius: 32,\s*paddingHorizontal: 24,\s*paddingVertical: 24/g, 'borderRadius: 36,\n    paddingHorizontal: 28,\n    paddingVertical: 28'],
    [/borderRadius: 24,\s*padding: 20/g, 'borderRadius: 28,\n    padding: 24'],
    [/borderRadius: 14,\s*color: '#E5E4E2',\s*fontSize: 14,\s*fontFamily: 'Inter_400Regular',\s*paddingHorizontal: 16,\s*paddingVertical: 14,/g, "borderRadius: 20,\n    color: '#E5E4E2',\n    fontSize: 15,\n    fontFamily: 'Inter_400Regular',\n    paddingHorizontal: 18,\n    paddingVertical: 16,"],
    [/borderRadius: 14,\s*color: '#E5E4E2',\s*fontSize: 12,\s*fontFamily: 'Inter_400Regular',\s*paddingHorizontal: 10,\s*paddingVertical: 8,/g, "borderRadius: 20,\n    color: '#E5E4E2',\n    fontSize: 13,\n    fontFamily: 'Inter_400Regular',\n    paddingHorizontal: 16,\n    paddingVertical: 12,"],
    [/borderRadius: 14,/g, 'borderRadius: 18,'],
    [/borderRadius: 16,/g, 'borderRadius: 20,'],
    [/borderRadius: 18,/g, 'borderRadius: 22,'],
    [/rgba\(31,\s*31,\s*31,\s*0\.7\)/g, 'rgba(32, 32, 32, 0.8)'],
    [/rgba\(255,\s*255,\s*255,\s*0\.08\)/g, 'rgba(255, 255, 255, 0.12)'],
];

for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
}

content = content.replace(/shadowOpacity: 0\.4,/g, 'shadowOpacity: 0.6,');
content = content.replace(/shadowOpacity: 0\.5,/g, 'shadowOpacity: 0.7,');
content = content.replace(/shadowOpacity: 0\.6,/g, 'shadowOpacity: 0.8,');
content = content.replace(/shadowRadius: 20,/g, 'shadowRadius: 28,');
content = content.replace(/shadowRadius: 24,/g, 'shadowRadius: 36,');

fs.writeFileSync(targetFile, content);
console.log('App styles updated.');
